package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/jackc/pgx/v5"
	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/auth"
	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/store"
)

type Server struct {
	DB                 *store.Store
	Auth               auth.Validator
	AIURL              string
	AIToken            string
	AIMatchingEnabled  bool
	CORSAllowedOrigins []string
	trustedProxies     []*net.IPNet
	metrics            apiMetrics
	mux                *http.ServeMux
}
type envelope map[string]any
type Item struct {
	ID              string `json:"id"`
	InstitutionID   string `json:"institution_id"`
	InstitutionName string `json:"institution_name"`
	Category        string `json:"category"`
	Title           string `json:"title"`
	Description     string `json:"description"`
	Location        string `json:"location"`
	OccurredOn      string `json:"occurred_on,omitempty"`
	Kind            string `json:"kind"`
	Status          string `json:"status"`
	ReviewStatus    string `json:"-"`
}

var (
	emailPattern = regexp.MustCompile(`\b[^\s@]+@[^\s@]+\.[^\s@]+\b`)
	phonePattern = regexp.MustCompile(`\+?[0-9][0-9 .()/-]{7,}[0-9]`)
)

func New(db *store.Store, v auth.Validator, ai string) *Server {
	s := &Server{DB: db, Auth: v, AIURL: ai, mux: http.NewServeMux()}
	s.routes()
	return s
}
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.observeHTTP(w, r, s.serveHTTP)
}

func (s *Server) serveHTTP(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	allowed := false
	for _, candidate := range s.CORSAllowedOrigins {
		if origin == candidate {
			allowed = true
			break
		}
	}
	if allowed {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
	}
	if r.Method == http.MethodOptions {
		if allowed {
			w.WriteHeader(http.StatusNoContent)
		} else {
			fail(w, http.StatusForbidden, "cors_denied", "origin is not allowed")
		}
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Method != http.MethodOptions {
		if _, err := r.Cookie(auth.SessionCookieName); err == nil && (origin == "" || !allowed) {
			fail(w, http.StatusForbidden, "origin_denied", "cookie-authenticated requests require an allowed browser origin")
			return
		}
	}
	s.mux.ServeHTTP(w, r)
}
func (s *Server) routes() {
	s.mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { write(w, 200, envelope{"status": "ok"}) })
	s.mux.HandleFunc("GET /readyz", s.ready)
	s.mux.HandleFunc("GET /metrics", func(w http.ResponseWriter, r *http.Request) { s.metrics.serve(w) })
	s.mux.HandleFunc("POST /api/v1/auth/register", s.registerAccount)
	s.mux.HandleFunc("POST /api/v1/auth/login", s.signIn)
	s.mux.HandleFunc("POST /api/v1/auth/verify-email", s.verifyEmail)
	s.mux.HandleFunc("POST /api/v1/auth/verification/request", s.resendVerification)
	s.mux.HandleFunc("POST /api/v1/auth/password-reset/request", s.requestPasswordReset)
	s.mux.HandleFunc("POST /api/v1/auth/password-reset/confirm", s.resetPassword)
	s.mux.HandleFunc("POST /api/v1/auth/logout", s.signOut)
	s.mux.HandleFunc("POST /api/v1/auth/logout-all", s.signOutAll)
	s.mux.HandleFunc("GET /api/v1/auth/me", s.currentAccount)
	s.mux.HandleFunc("GET /api/v1/institutions", s.listInstitutions)
	s.mux.HandleFunc("GET /api/v1/institutions/{institutionID}", s.getInstitution)
	s.mux.HandleFunc("GET /api/v1/items", s.listItems)
	s.mux.HandleFunc("GET /api/v1/items/search", s.searchPublicItems)
	s.mux.HandleFunc("GET /api/v1/items/{itemID}", s.getItem)
	s.mux.HandleFunc("POST /api/v1/reports", s.createReport)
	s.mux.HandleFunc("GET /api/v1/me/reports", s.myReports)
	s.mux.HandleFunc("POST /api/v1/me/claims", s.createClaim)
	s.mux.HandleFunc("GET /api/v1/me/claims", s.myClaims)
	s.mux.HandleFunc("GET /api/v1/staff/institutions", s.staffInstitutions)
	s.mux.HandleFunc("GET /api/v1/staff/institutions/{institutionID}/cases", s.staffCases)
	s.mux.HandleFunc("GET /api/v1/staff/institutions/{institutionID}/claims", s.staffClaims)
	s.mux.HandleFunc("PATCH /api/v1/staff/institutions/{institutionID}/cases/{caseID}", s.updateCase)
	s.mux.HandleFunc("POST /api/v1/staff/institutions/{institutionID}/claims/{claimID}/review", s.reviewClaim)
	s.mux.HandleFunc("POST /api/v1/staff/institutions/{institutionID}/claims/{claimID}/verification", s.recordClaimVerification)
	s.mux.HandleFunc("POST /api/v1/staff/institutions/{institutionID}/items/{itemID}/review", s.reviewItem)
	s.mux.HandleFunc("POST /api/v1/staff/institutions/{institutionID}/cases/{caseID}/handover", s.handover)
	s.mux.HandleFunc("GET /api/v1/institutions/{institutionID}/stats", s.institutionStats)
	s.mux.HandleFunc("GET /api/v1/platform/stats", s.platformStats)
	s.mux.HandleFunc("GET /api/v1/platform/institutions", s.platformInstitutions)
	s.mux.HandleFunc("POST /api/v1/platform/institutions", s.createPlatformInstitution)
	s.mux.HandleFunc("PATCH /api/v1/platform/institutions/{institutionID}", s.updatePlatformInstitution)
	s.mux.HandleFunc("GET /api/v1/platform/institutions/{institutionID}/memberships", s.platformMemberships)
	s.mux.HandleFunc("PUT /api/v1/platform/institutions/{institutionID}/memberships", s.setPlatformMembership)
	s.mux.HandleFunc("GET /api/v1/platform/admins", s.platformAdmins)
	s.mux.HandleFunc("PUT /api/v1/platform/admins", s.setPlatformAdmin)
	s.mux.HandleFunc("GET /api/v1/platform/audit-events", s.platformAuditEvents)
	s.mux.HandleFunc("POST /api/v1/staff/institutions/{institutionID}/matches/suggest", s.matchSuggestions)
}
func write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, status int, code, msg string) {
	write(w, status, envelope{"error": envelope{"code": code, "message": msg}})
}
func (s *Server) ready(w http.ResponseWriter, r *http.Request) {
	if err := s.DB.Ensure(); err != nil {
		fail(w, http.StatusServiceUnavailable, "not_ready", "database is not configured")
		return
	}
	if err := s.DB.Pool.Ping(r.Context()); err != nil {
		fail(w, http.StatusServiceUnavailable, "not_ready", "database unavailable")
		return
	}
	write(w, http.StatusOK, envelope{"status": "ready"})
}
func (s *Server) listInstitutions(w http.ResponseWriter, r *http.Request) {
	if err := s.DB.Ensure(); err != nil {
		fail(w, http.StatusServiceUnavailable, "unavailable", "database is not configured")
		return
	}
	rows, err := s.DB.Pool.Query(r.Context(), `SELECT id::text,name,region FROM institutions WHERE active=true ORDER BY name`)
	if err != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, name, region string
		if err := rows.Scan(&id, &name, &region); err != nil {
			dbfail(w)
			return
		}
		out = append(out, map[string]any{"id": id, "name": name, "region": region})
	}
	if rows.Err() != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusOK, envelope{"data": out})
}
func (s *Server) getInstitution(w http.ResponseWriter, r *http.Request) {
	if err := s.DB.Ensure(); err != nil {
		fail(w, http.StatusServiceUnavailable, "unavailable", "database is not configured")
		return
	}
	id := r.PathValue("institutionID")
	var name, region string
	err := s.DB.Pool.QueryRow(r.Context(), `SELECT name,region FROM institutions WHERE id::text=$1 AND active=true`, id).Scan(&name, &region)
	if errors.Is(err, pgx.ErrNoRows) {
		fail(w, http.StatusNotFound, "not_found", "institution not found")
		return
	}
	if err != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusOK, envelope{"data": map[string]any{"id": id, "name": name, "region": region}})
}
func publicItem(x Item) map[string]any {
	kind := x.Kind
	if kind == "" && (x.Status == "found" || x.Status == "lost") {
		kind = x.Status
	}
	return map[string]any{"id": x.ID, "institution_id": x.InstitutionID, "institution_name": x.InstitutionName, "category": x.Category, "title": x.Title, "description": x.Description, "location": x.Location, "occurred_on": x.OccurredOn, "kind": kind, "status": x.Status}
}
func (s *Server) listItems(w http.ResponseWriter, r *http.Request) {
	if !s.allowRateLimit(w, r, "public-items-list-ip", s.requestAddress(r), 120, time.Minute, "too many public listing requests; try again later") {
		return
	}
	if err := s.DB.Ensure(); err != nil {
		fail(w, http.StatusServiceUnavailable, "unavailable", "database is not configured")
		return
	}
	rows, err := s.DB.Pool.Query(r.Context(), `SELECT i.id::text,i.institution_id::text,i.institution_name,i.category,i.public_title,i.public_description,i.public_location,COALESCE(i.occurred_on::text,''),i.kind,i.status FROM public_items i WHERE ($1='' OR to_tsvector('simple',coalesce(i.public_title,'')||' '||coalesce(i.public_description,'')||' '||coalesce(i.category,'')) @@ plainto_tsquery('simple',$1)) ORDER BY i.occurred_on DESC NULLS LAST,i.id DESC LIMIT 100`, r.URL.Query().Get("q"))
	if err != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var item Item
		if err := rows.Scan(&item.ID, &item.InstitutionID, &item.InstitutionName, &item.Category, &item.Title, &item.Description, &item.Location, &item.OccurredOn, &item.Kind, &item.Status); err != nil {
			dbfail(w)
			return
		}
		out = append(out, publicItem(item))
	}
	if rows.Err() != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusOK, envelope{"data": out})
}
func hasContactDetails(value string) bool {
	return emailPattern.MatchString(value) || phonePattern.MatchString(value)
}

func (s *Server) searchPublicItems(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	kind := strings.TrimSpace(r.URL.Query().Get("kind"))
	category := strings.TrimSpace(r.URL.Query().Get("category"))
	institutionID := strings.TrimSpace(r.URL.Query().Get("institution_id"))
	if len(query) > 200 || len(category) > 80 || len(institutionID) > 100 || (kind != "" && kind != "lost" && kind != "found") || hasContactDetails(query) {
		fail(w, http.StatusBadRequest, "invalid_search", "search filters are invalid or contain contact details")
		return
	}
	if !s.allowRateLimit(w, r, "public-search-ip", s.requestAddress(r), 60, time.Minute, "too many public search requests; try again later") {
		return
	}
	if err := s.DB.Ensure(); err != nil {
		fail(w, http.StatusServiceUnavailable, "unavailable", "database is not configured")
		return
	}

	if query != "" && s.AIMatchingEnabled && s.AIURL != "" {
		candidates, err := s.publicSearchCandidates(r, kind, category, institutionID)
		if err != nil {
			dbfail(w)
			return
		}
		queryRecord := aiRecord{RecordID: "public-search-query", Category: category, Description: query}
		aiCandidates := make([]aiRecord, 0, len(candidates))
		byID := make(map[string]Item, len(candidates))
		for _, candidate := range candidates {
			aiCandidates = append(aiCandidates, aiRecordForPublicItem(candidate))
			byID[candidate.ID] = candidate
		}
		if result, err := s.callMatchService(r.Context(), queryRecord, aiCandidates); err == nil {
			items := make([]map[string]any, 0, len(result.Suggestions))
			for _, suggestion := range result.Suggestions {
				if item, ok := byID[suggestion.CandidateID]; ok {
					items = append(items, publicItem(item))
				}
			}
			write(w, http.StatusOK, envelope{"data": map[string]any{"source": rankingSource(result.Ranking), "items": items, "ranking": result.Ranking, "notice": "Results rank reviewed public summaries only. Similarity is a search aid, not identity or ownership evidence."}})
			return
		}
	}

	rows, err := s.DB.Pool.Query(r.Context(), `SELECT i.id::text,i.institution_id::text,i.institution_name,i.category,i.public_title,i.public_description,i.public_location,COALESCE(i.occurred_on::text,''),i.kind,i.status FROM public_items i WHERE ($1='' OR to_tsvector('simple',coalesce(i.public_title,'')||' '||coalesce(i.public_description,'')||' '||coalesce(i.category,'')) @@ plainto_tsquery('simple',$1)) AND ($2='' OR i.kind=$2) AND ($3='' OR i.category=$3) AND ($4='' OR i.institution_id::text=$4) ORDER BY i.occurred_on DESC NULLS LAST,i.id DESC LIMIT 100`, query, kind, category, institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var item Item
		if err := rows.Scan(&item.ID, &item.InstitutionID, &item.InstitutionName, &item.Category, &item.Title, &item.Description, &item.Location, &item.OccurredOn, &item.Kind, &item.Status); err != nil {
			dbfail(w)
			return
		}
		items = append(items, publicItem(item))
	}
	if rows.Err() != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusOK, envelope{"data": map[string]any{"source": "text_search", "items": items, "notice": "Showing reviewed public summaries using text search."}})
}
func (s *Server) publicSearchCandidates(r *http.Request, kind, category, institutionID string) ([]Item, error) {
	if err := s.DB.Ensure(); err != nil {
		return nil, err
	}
	rows, err := s.DB.Pool.Query(r.Context(), `SELECT i.id::text,i.institution_id::text,i.institution_name,i.category,i.public_title,i.public_description,i.public_location,COALESCE(i.occurred_on::text,''),i.kind,i.status FROM public_items i WHERE ($1='' OR i.kind=$1) AND ($2='' OR i.category=$2) AND ($3='' OR i.institution_id::text=$3) ORDER BY i.occurred_on DESC NULLS LAST,i.id DESC LIMIT 50`, kind, category, institutionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]Item, 0, 50)
	for rows.Next() {
		var item Item
		if err := rows.Scan(&item.ID, &item.InstitutionID, &item.InstitutionName, &item.Category, &item.Title, &item.Description, &item.Location, &item.OccurredOn, &item.Kind, &item.Status); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
func aiRecordForPublicItem(item Item) aiRecord {
	return aiRecord{RecordID: item.ID, Category: item.Category, Description: strings.TrimSpace(item.Title + " " + item.Description), ObservedDate: item.OccurredOn, Location: item.Location}
}

func (s *Server) getItem(w http.ResponseWriter, r *http.Request) {
	if err := s.DB.Ensure(); err != nil {
		fail(w, http.StatusServiceUnavailable, "unavailable", "database is not configured")
		return
	}
	id := r.PathValue("itemID")
	var item Item
	err := s.DB.Pool.QueryRow(r.Context(), `SELECT i.id::text,i.institution_id::text,i.institution_name,i.category,i.public_title,i.public_description,i.public_location,COALESCE(i.occurred_on::text,''),i.kind,i.status FROM public_items i WHERE i.id::text=$1`, id).Scan(&item.ID, &item.InstitutionID, &item.InstitutionName, &item.Category, &item.Title, &item.Description, &item.Location, &item.OccurredOn, &item.Kind, &item.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		fail(w, http.StatusNotFound, "not_found", "item not found")
		return
	}
	if err != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusOK, envelope{"data": publicItem(item)})
}

type identity struct{ ID string }

func (s *Server) private(w http.ResponseWriter, r *http.Request) (identity, bool) {
	u, e := s.Auth.Validate(r.Context(), requestAuthHeader(r))
	if e != nil {
		if errors.Is(e, auth.ErrNotConfigured) {
			fail(w, 503, "auth_unavailable", "authentication is not configured")
		} else if errors.Is(e, auth.ErrUnauthenticated) {
			fail(w, 401, "unauthorized", "a valid session is required")
		} else {
			fail(w, 503, "auth_unavailable", "identity provider unavailable")
		}
		return identity{}, false
	}
	if s.DB == nil {
		fail(w, 503, "database_unavailable", "private operations require a configured database")
		return identity{}, false
	}
	return identity{u.ID}, true
}
func body(r *http.Request, dst any) error {
	r.Body = http.MaxBytesReader(nil, r.Body, 1<<20)
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(dst)
}
func (s *Server) createReport(w http.ResponseWriter, r *http.Request) {
	u, ok := s.private(w, r)
	if !ok {
		return
	}
	if !s.allowRateLimit(w, r, "report-user", u.ID, 10, time.Hour, "report submission limit reached; try again later") {
		return
	}
	var input struct {
		InstitutionID string `json:"institution_id"`
		Kind          string `json:"kind"`
		Category      string `json:"category"`
		Title         string `json:"title"`
		Description   string `json:"description"`
		Location      string `json:"location"`
		OccurredOn    string `json:"occurred_on"`
		Contact       string `json:"contact_details"`
	}
	if body(r, &input) != nil || input.InstitutionID == "" || input.Title == "" || (input.Kind != "lost" && input.Kind != "found") {
		fail(w, http.StatusBadRequest, "invalid_request", "institution_id, title, and kind (lost or found) are required")
		return
	}
	tx, err := s.DB.BeginInstitution(r.Context(), u.ID, input.InstitutionID)
	if err != nil {
		dbfail(w)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	var id string
	err = tx.QueryRow(r.Context(), `INSERT INTO items (institution_id,reporter_id,kind,category,private_title,private_description,private_location,occurred_on,contact_details,status,review_status,visibility) SELECT id,$2,$3,$4,$5,$6,$7,NULLIF($8,'')::date,$9,'open','pending','private' FROM institutions WHERE id::text=$1 AND active=true RETURNING id::text`, input.InstitutionID, u.ID, input.Kind, input.Category, input.Title, input.Description, input.Location, input.OccurredOn, input.Contact).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		fail(w, http.StatusBadRequest, "invalid_institution", "institution unavailable or report invalid")
		return
	}
	if err != nil {
		dbfail(w)
		return
	}
	if _, err := tx.Exec(r.Context(), `INSERT INTO cases(item_id,institution_id,status) SELECT id,institution_id,'open' FROM items WHERE id::text=$1`, id); err != nil {
		dbfail(w)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusCreated, envelope{"data": map[string]string{"id": id, "status": "submitted_for_review"}})
}
func (s *Server) myReports(w http.ResponseWriter, r *http.Request) {
	u, ok := s.private(w, r)
	if !ok {
		return
	}
	tx, err := s.DB.BeginUser(r.Context(), u.ID)
	if err != nil {
		dbfail(w)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	rows, err := tx.Query(r.Context(), `SELECT id::text,kind,status,review_status,created_at FROM items WHERE reporter_id=$1 ORDER BY created_at DESC`, u.ID)
	if err != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, kind, status, reviewStatus string
		var createdAt time.Time
		if err := rows.Scan(&id, &kind, &status, &reviewStatus, &createdAt); err != nil {
			dbfail(w)
			return
		}
		out = append(out, map[string]any{"id": id, "kind": kind, "status": status, "review_status": reviewStatus, "created_at": createdAt})
	}
	if rows.Err() != nil {
		dbfail(w)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusOK, envelope{"data": out})
}
func (s *Server) createClaim(w http.ResponseWriter, r *http.Request) {
	u, ok := s.private(w, r)
	if !ok {
		return
	}
	if !s.allowRateLimit(w, r, "claim-user", u.ID, 5, time.Hour, "claim submission limit reached; try again later") {
		return
	}
	var input struct {
		ItemID    string `json:"item_id"`
		Statement string `json:"statement"`
		Contact   string `json:"contact_details"`
		Evidence  string `json:"evidence_reference"`
	}
	if body(r, &input) != nil || input.ItemID == "" || input.Statement == "" {
		fail(w, http.StatusBadRequest, "invalid_request", "item_id and statement are required")
		return
	}
	tx, err := s.DB.BeginUser(r.Context(), u.ID)
	if err != nil {
		dbfail(w)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	var id string
	err = tx.QueryRow(r.Context(), `INSERT INTO claims(item_id,claimant_id,statement,contact_details,evidence_reference,status) SELECT id,$2,$3,$4,$5,'pending' FROM public_items WHERE id::text=$1 AND kind='found' RETURNING id::text`, input.ItemID, u.ID, input.Statement, input.Contact, input.Evidence).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		fail(w, http.StatusBadRequest, "invalid_item", "item unavailable or claim invalid")
		return
	}
	if err != nil {
		dbfail(w)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusCreated, envelope{"data": map[string]string{"id": id, "status": "pending_review"}})
}
func (s *Server) myClaims(w http.ResponseWriter, r *http.Request) {
	u, ok := s.private(w, r)
	if !ok {
		return
	}
	tx, err := s.DB.BeginUser(r.Context(), u.ID)
	if err != nil {
		dbfail(w)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	rows, err := tx.Query(r.Context(), `SELECT id::text,item_id::text,status,created_at FROM claims WHERE claimant_id=$1 ORDER BY created_at DESC`, u.ID)
	if err != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, itemID, status string
		var createdAt time.Time
		if err := rows.Scan(&id, &itemID, &status, &createdAt); err != nil {
			dbfail(w)
			return
		}
		out = append(out, map[string]any{"id": id, "item_id": itemID, "status": status, "created_at": createdAt})
	}
	if rows.Err() != nil {
		dbfail(w)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusOK, envelope{"data": out})
}
func (s *Server) staff(w http.ResponseWriter, r *http.Request) (identity, bool) {
	u, ok := s.private(w, r)
	if !ok {
		return identity{}, false
	}
	inst := r.PathValue("institutionID")
	allowed, e := s.DB.Member(r.Context(), u.ID, inst, "staff", "institution_admin")
	if e != nil {
		dbfail(w)
		return identity{}, false
	}
	if !allowed {
		fail(w, 403, "forbidden", "institution staff membership required")
		return identity{}, false
	}
	return u, true
}
func (s *Server) staffCases(w http.ResponseWriter, r *http.Request) {
	user, ok := s.staff(w, r)
	if !ok {
		return
	}
	institutionID := r.PathValue("institutionID")
	tx, err := s.DB.BeginInstitution(r.Context(), user.ID, institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	rows, err := tx.Query(r.Context(), `SELECT c.id::text,c.item_id::text,c.status,i.kind,i.category,i.private_title,i.private_description,i.private_location,i.review_status,i.visibility,i.public_title,i.public_description,i.public_location FROM cases c JOIN items i ON i.id=c.item_id WHERE c.institution_id::text=$1 ORDER BY c.created_at DESC`, institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, itemID, status, kind, category, title, description, location, reviewStatus, visibility, publicTitle, publicDescription, publicLocation string
		if err := rows.Scan(&id, &itemID, &status, &kind, &category, &title, &description, &location, &reviewStatus, &visibility, &publicTitle, &publicDescription, &publicLocation); err != nil {
			dbfail(w)
			return
		}
		out = append(out, map[string]any{"id": id, "item_id": itemID, "status": status, "kind": kind, "category": category, "private_title": title, "private_description": description, "private_location": location, "review_status": reviewStatus, "visibility": visibility, "public_title": publicTitle, "public_description": publicDescription, "public_location": publicLocation})
	}
	if rows.Err() != nil {
		dbfail(w)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusOK, envelope{"data": out})
}
func (s *Server) staffClaims(w http.ResponseWriter, r *http.Request) {
	user, ok := s.staff(w, r)
	if !ok {
		return
	}
	institutionID := r.PathValue("institutionID")
	tx, err := s.DB.BeginInstitution(r.Context(), user.ID, institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	rows, err := tx.Query(r.Context(), `SELECT c.id::text,c.item_id::text,c.claimant_id::text,c.statement,c.contact_details,c.evidence_reference,c.status,c.created_at,COALESCE(v.verification_method,''),COALESCE(v.verified_at::text,'') FROM claims c JOIN items i ON i.id=c.item_id LEFT JOIN claim_verifications v ON v.claim_id=c.id AND v.approved_at=c.reviewed_at WHERE i.institution_id::text=$1 ORDER BY c.created_at DESC LIMIT 100`, institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, itemID, claimantID, statement, contact, evidence, status, verificationMethod, verifiedAt string
		var createdAt time.Time
		if err := rows.Scan(&id, &itemID, &claimantID, &statement, &contact, &evidence, &status, &createdAt, &verificationMethod, &verifiedAt); err != nil {
			dbfail(w)
			return
		}
		out = append(out, map[string]any{"id": id, "item_id": itemID, "claimant_id": claimantID, "statement": statement, "contact_details": contact, "evidence_reference": evidence, "status": status, "created_at": createdAt, "verification_method": verificationMethod, "verified_at": verifiedAt})
	}
	if rows.Err() != nil {
		dbfail(w)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusOK, envelope{"data": out})
}
func (s *Server) reviewItem(w http.ResponseWriter, r *http.Request) {
	user, ok := s.staff(w, r)
	if !ok {
		return
	}
	var input struct {
		Status            string `json:"status"`
		PublicTitle       string `json:"public_title"`
		PublicDescription string `json:"public_description"`
		PublicLocation    string `json:"public_location"`
	}
	if body(r, &input) != nil || (input.Status != "approved" && input.Status != "rejected") || (input.Status == "approved" && (strings.TrimSpace(input.PublicTitle) == "" || len(input.PublicTitle) > 120 || len(input.PublicDescription) > 2000 || len(input.PublicLocation) > 120 || hasContactDetails(input.PublicTitle+" "+input.PublicDescription+" "+input.PublicLocation))) {
		fail(w, http.StatusBadRequest, "invalid_request", "approval requires a safe public title, description, and location without contact details")
		return
	}
	visibility := "private"
	if input.Status == "approved" {
		visibility = "public"
	}
	institutionID := r.PathValue("institutionID")
	tx, err := s.DB.BeginInstitution(r.Context(), user.ID, institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	tag, err := tx.Exec(r.Context(), `UPDATE items SET review_status=$1,visibility=$2,public_title=$3,public_description=$4,public_location=$5 WHERE id::text=$6 AND institution_id::text=$7`, input.Status, visibility, input.PublicTitle, input.PublicDescription, input.PublicLocation, r.PathValue("itemID"), institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, http.StatusNotFound, "not_found", "item not found")
		return
	}
	if err := recordAuditEvent(r.Context(), tx, institutionID, user.ID, "item.reviewed", "item", r.PathValue("itemID"), map[string]any{"review_status": input.Status}); err != nil {
		dbfail(w)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusOK, envelope{"data": map[string]string{"review_status": input.Status, "visibility": visibility}})
}
func (s *Server) updateCase(w http.ResponseWriter, r *http.Request) {
	user, ok := s.staff(w, r)
	if !ok {
		return
	}
	var input struct {
		Status string `json:"status"`
	}
	if body(r, &input) != nil || !oneOf(input.Status, "open", "under_review", "matched", "closed") {
		fail(w, http.StatusBadRequest, "invalid_request", "status must be open, under_review, matched, or closed; use the verified handover endpoint to record a return")
		return
	}
	institutionID := r.PathValue("institutionID")
	tx, err := s.DB.BeginInstitution(r.Context(), user.ID, institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	tag, err := tx.Exec(r.Context(), `UPDATE cases SET status=$1,updated_at=now() WHERE id::text=$2 AND institution_id::text=$3`, input.Status, r.PathValue("caseID"), institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, http.StatusNotFound, "not_found", "case not found")
		return
	}
	if err := recordAuditEvent(r.Context(), tx, institutionID, user.ID, "case.updated", "case", r.PathValue("caseID"), map[string]any{"status": input.Status}); err != nil {
		dbfail(w)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusOK, envelope{"data": map[string]string{"status": input.Status}})
}
func (s *Server) reviewClaim(w http.ResponseWriter, r *http.Request) {
	user, ok := s.staff(w, r)
	if !ok {
		return
	}
	var input struct {
		Status    string `json:"status"`
		StaffNote string `json:"staff_note"`
	}
	if body(r, &input) != nil || !oneOf(input.Status, "approved", "rejected", "needs_information") {
		fail(w, http.StatusBadRequest, "invalid_request", "status must be approved, rejected, or needs_information")
		return
	}
	institutionID := r.PathValue("institutionID")
	tx, err := s.DB.BeginInstitution(r.Context(), user.ID, institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	tag, err := tx.Exec(r.Context(), `UPDATE claims SET status=$1,staff_note=$2,reviewed_at=now() FROM items i WHERE claims.item_id=i.id AND claims.id::text=$3 AND i.institution_id::text=$4`, input.Status, input.StaffNote, r.PathValue("claimID"), institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, http.StatusNotFound, "not_found", "claim not found")
		return
	}
	if err := recordAuditEvent(r.Context(), tx, institutionID, user.ID, "claim.reviewed", "claim", r.PathValue("claimID"), map[string]any{"status": input.Status}); err != nil {
		dbfail(w)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusOK, envelope{"data": map[string]string{"status": input.Status}})
}

func (s *Server) recordClaimVerification(w http.ResponseWriter, r *http.Request) {
	user, ok := s.staff(w, r)
	if !ok {
		return
	}
	var input struct {
		Method string `json:"verification_method"`
		Note   string `json:"verification_note"`
	}
	if body(r, &input) != nil {
		fail(w, http.StatusBadRequest, "invalid_request", "verification_method and verification_note are required")
		return
	}
	input.Note = strings.TrimSpace(input.Note)
	if !oneOf(input.Method, "in_person", "video_call", "document_review", "other") || utf8.RuneCountInString(input.Note) < 8 || utf8.RuneCountInString(input.Note) > 2000 {
		fail(w, http.StatusBadRequest, "invalid_request", "verification_method must be in_person, video_call, document_review, or other, and verification_note must contain 8 to 2000 characters")
		return
	}
	institutionID := r.PathValue("institutionID")
	tx, err := s.DB.BeginInstitution(r.Context(), user.ID, institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	var claimStatus string
	var hasApprovalTimestamp bool
	err = tx.QueryRow(r.Context(), `SELECT c.status,c.reviewed_at IS NOT NULL FROM claims c JOIN items i ON i.id=c.item_id WHERE c.id::text=$1 AND i.institution_id::text=$2 AND i.kind='found' FOR UPDATE OF c`, r.PathValue("claimID"), institutionID).Scan(&claimStatus, &hasApprovalTimestamp)
	if errors.Is(err, pgx.ErrNoRows) {
		fail(w, http.StatusNotFound, "not_found", "claim not found")
		return
	}
	if err != nil {
		dbfail(w)
		return
	}
	if claimStatus != "approved" || !hasApprovalTimestamp {
		fail(w, http.StatusConflict, "claim_not_approved", "only an approved claim can have a verification recorded")
		return
	}
	var verificationID, verifiedAt string
	err = tx.QueryRow(r.Context(), `INSERT INTO claim_verifications(claim_id,item_id,institution_id,verified_by,approved_at,verification_method,verification_note) SELECT c.id,c.item_id,i.institution_id,$3,c.reviewed_at,$4,$5 FROM claims c JOIN items i ON i.id=c.item_id WHERE c.id::text=$1 AND i.institution_id::text=$2 AND i.kind='found' AND c.status='approved' AND c.reviewed_at IS NOT NULL ON CONFLICT (claim_id,approved_at) DO NOTHING RETURNING id::text,verified_at::text`, r.PathValue("claimID"), institutionID, user.ID, input.Method, input.Note).Scan(&verificationID, &verifiedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		fail(w, http.StatusConflict, "verification_already_recorded", "this approval already has a verification record")
		return
	}
	if err != nil {
		dbfail(w)
		return
	}
	if err := recordAuditEvent(r.Context(), tx, institutionID, user.ID, "claim.verified", "claim", r.PathValue("claimID"), map[string]any{"verification_method": input.Method}); err != nil {
		dbfail(w)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusCreated, envelope{"data": map[string]string{"status": "verified", "verified_at": verifiedAt}})
}

func (s *Server) handover(w http.ResponseWriter, r *http.Request) {
	user, ok := s.staff(w, r)
	if !ok {
		return
	}
	var input struct {
		ClaimID    string `json:"claim_id"`
		HandoverAt string `json:"handover_at"`
		Details    string `json:"details"`
		Recipient  string `json:"recipient"`
	}
	if body(r, &input) != nil || input.HandoverAt == "" || input.ClaimID == "" {
		fail(w, http.StatusBadRequest, "invalid_request", "claim_id and handover_at are required")
		return
	}
	institutionID := r.PathValue("institutionID")
	tx, err := s.DB.BeginInstitution(r.Context(), user.ID, institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	var itemID, caseStatus string
	err = tx.QueryRow(r.Context(), `SELECT item_id::text,status FROM cases WHERE id::text=$1 AND institution_id::text=$2 FOR UPDATE`, r.PathValue("caseID"), institutionID).Scan(&itemID, &caseStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		fail(w, http.StatusNotFound, "not_found", "case not found")
		return
	}
	if err != nil {
		dbfail(w)
		return
	}
	if caseStatus != "matched" {
		fail(w, http.StatusConflict, "handover_not_ready", "the case must be matched before a handover can be recorded")
		return
	}
	var verifiedClaimID string
	err = tx.QueryRow(r.Context(), `SELECT c.id::text FROM claims c JOIN claim_verifications v ON v.claim_id=c.id AND v.approved_at=c.reviewed_at JOIN items i ON i.id=c.item_id AND i.kind='found' WHERE c.id::text=$1 AND c.item_id::text=$2 AND c.status='approved' FOR UPDATE OF c`, input.ClaimID, itemID).Scan(&verifiedClaimID)
	if errors.Is(err, pgx.ErrNoRows) {
		fail(w, http.StatusConflict, "handover_not_verified", "a staff-approved claim with a current recorded verification for this case is required before handover")
		return
	}
	if err != nil {
		dbfail(w)
		return
	}
	var alreadyRecorded bool
	if err := tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM handovers WHERE case_id::text=$1)`, r.PathValue("caseID")).Scan(&alreadyRecorded); err != nil {
		dbfail(w)
		return
	}
	if alreadyRecorded {
		fail(w, http.StatusConflict, "handover_already_recorded", "this case already has a recorded handover")
		return
	}
	if _, err := tx.Exec(r.Context(), `INSERT INTO handovers(case_id,institution_id,claim_id,recorded_by,handover_at,details,recipient) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::timestamptz,$6,$7)`, r.PathValue("caseID"), institutionID, input.ClaimID, user.ID, input.HandoverAt, input.Details, input.Recipient); err != nil {
		dbfail(w)
		return
	}
	tag, err := tx.Exec(r.Context(), `UPDATE cases SET status='returned',updated_at=now() WHERE id::text=$1 AND institution_id::text=$2`, r.PathValue("caseID"), institutionID)
	if err != nil || tag.RowsAffected() == 0 {
		dbfail(w)
		return
	}
	if _, err := tx.Exec(r.Context(), `UPDATE items SET status='returned' WHERE id=(SELECT item_id FROM cases WHERE id::text=$1 AND institution_id::text=$2)`, r.PathValue("caseID"), institutionID); err != nil {
		dbfail(w)
		return
	}
	if err := recordAuditEvent(r.Context(), tx, institutionID, user.ID, "handover.recorded", "case", r.PathValue("caseID"), map[string]any{}); err != nil {
		dbfail(w)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusCreated, envelope{"data": map[string]string{"status": "recorded_privately"}})
}
func (s *Server) institutionStats(w http.ResponseWriter, r *http.Request) {
	user, ok := s.private(w, r)
	if !ok {
		return
	}
	institutionID := r.PathValue("institutionID")
	allowed, err := s.DB.Member(r.Context(), user.ID, institutionID, "staff", "institution_admin")
	if err != nil {
		dbfail(w)
		return
	}
	if !allowed {
		fail(w, http.StatusForbidden, "forbidden", "institution membership required")
		return
	}
	stats, err := s.DB.InstitutionStats(r.Context(), user.ID, institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusOK, envelope{"data": stats})
}
func (s *Server) platformStats(w http.ResponseWriter, r *http.Request) {
	user, ok := s.private(w, r)
	if !ok {
		return
	}
	allowed, err := s.DB.PlatformAdmin(r.Context(), user.ID)
	if err != nil {
		dbfail(w)
		return
	}
	if !allowed {
		fail(w, http.StatusForbidden, "forbidden", "platform administrator required")
		return
	}
	stats, err := s.DB.PlatformStats(r.Context(), user.ID)
	if err != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusOK, envelope{"data": stats})
}

type aiRecord struct {
	RecordID     string `json:"record_id"`
	Category     string `json:"category"`
	Description  string `json:"description"`
	ObservedDate string `json:"observed_date,omitempty"`
	Location     string `json:"location"`
}

type aiMatchRequest struct {
	Query      aiRecord   `json:"query"`
	Candidates []aiRecord `json:"candidates"`
}

type aiMatchResponse struct {
	Suggestions []aiMatchSuggestion `json:"suggestions"`
	Ranking     string              `json:"ranking"`
	Notice      string              `json:"notice"`
}

type aiMatchSuggestion struct {
	CandidateID  string        `json:"candidate_id"`
	Rank         int           `json:"rank"`
	Signal       aiMatchSignal `json:"signal"`
	Explanations []string      `json:"explanations"`
}

type aiMatchSignal struct {
	Name           string  `json:"name"`
	Version        string  `json:"version"`
	Score          float64 `json:"score"`
	Interpretation string  `json:"interpretation"`
}

func rankingSource(ranking string) string {
	if strings.HasPrefix(ranking, "embeddinggemma2_") {
		return "embeddinggemma"
	}
	if ranking != "" {
		return "assistive_ai"
	}
	return "assistive_ai"
}

func (s *Server) callMatchService(parent context.Context, query aiRecord, candidates []aiRecord) (aiMatchResponse, error) {
	if !s.AIMatchingEnabled || strings.TrimSpace(s.AIURL) == "" {
		return aiMatchResponse{}, errors.New("matching is not enabled")
	}
	encoded, err := json.Marshal(aiMatchRequest{Query: query, Candidates: candidates})
	if err != nil {
		return aiMatchResponse{}, err
	}
	ctx, cancel := context.WithTimeout(parent, 60*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(s.AIURL, "/")+"/v1/matches", bytes.NewReader(encoded))
	if err != nil {
		return aiMatchResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	if s.AIToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.AIToken)
	}
	resp, err := (&http.Client{Timeout: 60 * time.Second}).Do(req)
	if err != nil {
		return aiMatchResponse{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return aiMatchResponse{}, errors.New("matching service unavailable")
	}
	var result aiMatchResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&result); err != nil {
		return aiMatchResponse{}, err
	}
	return result, nil
}

func (s *Server) matchSuggestions(w http.ResponseWriter, r *http.Request) {
	user, ok := s.staff(w, r)
	if !ok {
		return
	}
	institutionID := r.PathValue("institutionID")
	if !s.allowRateLimit(w, r, "staff-matching", user.ID+":"+institutionID, 10, 15*time.Minute, "matching suggestions are temporarily rate-limited; try again later") {
		return
	}
	var input struct {
		ItemID       string `json:"item_id"`
		Category     string `json:"category"`
		MaxDaysApart int    `json:"max_days_apart"`
	}
	if body(r, &input) != nil || strings.TrimSpace(input.ItemID) == "" || !validMatchFilters(input.Category, input.MaxDaysApart) {
		fail(w, http.StatusBadRequest, "invalid_request", "item_id and supported matching filters are required")
		return
	}
	input.ItemID = strings.TrimSpace(input.ItemID)
	input.Category = strings.TrimSpace(input.Category)
	tx, err := s.DB.BeginInstitution(r.Context(), user.ID, institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	var query aiRecord
	var itemKind string
	err = tx.QueryRow(r.Context(), `SELECT id::text,category,concat_ws(' ',NULLIF(public_title,''),NULLIF(public_description,'')),COALESCE(occurred_on::text,''),public_location,kind FROM items WHERE id::text=$1 AND institution_id::text=$2 AND review_status='approved' AND visibility='public' AND status NOT IN ('returned','closed')`, input.ItemID, institutionID).Scan(&query.RecordID, &query.Category, &query.Description, &query.ObservedDate, &query.Location, &itemKind)
	if errors.Is(err, pgx.ErrNoRows) {
		fail(w, http.StatusNotFound, "not_found", "reviewed public item not found")
		return
	}
	if err != nil {
		dbfail(w)
		return
	}
	rows, err := tx.Query(r.Context(), `SELECT id::text,category,concat_ws(' ',NULLIF(public_title,''),NULLIF(public_description,'')),COALESCE(occurred_on::text,''),public_location,public_title FROM items WHERE institution_id::text=$1 AND id::text<>$2 AND kind<>$3 AND review_status='approved' AND visibility='public' AND status NOT IN ('returned','closed') AND ($4='' OR category=$4) AND ($5=0 OR (occurred_on IS NOT NULL AND $6<>'' AND abs(occurred_on-$6::date)<=$5)) ORDER BY CASE WHEN $6<>'' AND occurred_on IS NOT NULL THEN abs(occurred_on-$6::date) ELSE 2147483647 END, (category=$7) DESC, created_at DESC LIMIT 1200`, institutionID, input.ItemID, itemKind, input.Category, input.MaxDaysApart, query.ObservedDate, query.Category)
	if err != nil {
		dbfail(w)
		return
	}
	candidates := []aiRecord{}
	candidateDetails := map[string]map[string]string{}
	for rows.Next() {
		var candidate aiRecord
		var title string
		if err := rows.Scan(&candidate.RecordID, &candidate.Category, &candidate.Description, &candidate.ObservedDate, &candidate.Location, &title); err != nil {
			rows.Close()
			dbfail(w)
			return
		}
		candidates = append(candidates, candidate)
		candidateDetails[candidate.RecordID] = map[string]string{"title": title, "category": candidate.Category}
	}
	rowsErr := rows.Err()
	rows.Close()
	if rowsErr != nil {
		dbfail(w)
		return
	}
	if err := recordAuditEvent(r.Context(), tx, institutionID, user.ID, "match.shortlist_requested", "item", query.RecordID, map[string]any{
		"candidate_count":        len(candidates),
		"category_filter_used":   input.Category != "",
		"date_window_days":       input.MaxDaysApart,
		"assistive_ai_available": s.AIMatchingEnabled,
	}); err != nil {
		dbfail(w)
		return
	}
	if err := tx.Commit(r.Context()); err != nil {
		dbfail(w)
		return
	}
	if result, err := s.callMatchService(r.Context(), query, candidates); err == nil {
		suggestions := make([]map[string]any, 0, len(result.Suggestions))
		for _, suggestion := range result.Suggestions {
			if detail, ok := candidateDetails[suggestion.CandidateID]; ok {
				suggestions = append(suggestions, map[string]any{"candidate_id": suggestion.CandidateID, "title": detail["title"], "category": detail["category"], "rank": suggestion.Rank, "signal": suggestion.Signal, "explanations": suggestion.Explanations})
			}
		}
		write(w, http.StatusOK, envelope{"data": map[string]any{"source": rankingSource(result.Ranking), "suggestions": suggestions, "ranking": result.Ranking, "notice": result.Notice, "decision": "staff_review_required"}})
		return
	}

	fallbackTx, err := s.DB.BeginInstitution(r.Context(), user.ID, institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	defer func() { _ = fallbackTx.Rollback(r.Context()) }()
	textQuery := strings.TrimSpace(query.Category + " " + query.Description)
	rows, err = fallbackTx.Query(r.Context(), `SELECT id::text,public_title,category FROM items WHERE institution_id::text=$2 AND id::text<>$3 AND kind<>$4 AND review_status='approved' AND visibility='public' AND status NOT IN ('returned','closed') AND ($1='' OR to_tsvector('simple',coalesce(public_title,'')||' '||coalesce(public_description,'')||' '||coalesce(category,'')) @@ plainto_tsquery('simple',$1)) AND ($5='' OR category=$5) AND ($6=0 OR (occurred_on IS NOT NULL AND $7<>'' AND abs(occurred_on-$7::date)<=$6)) ORDER BY created_at DESC LIMIT 5`, textQuery, institutionID, input.ItemID, itemKind, input.Category, input.MaxDaysApart, query.ObservedDate)
	if err != nil {
		dbfail(w)
		return
	}
	out := []map[string]any{}
	for rows.Next() {
		var id, title, category string
		if err := rows.Scan(&id, &title, &category); err != nil {
			rows.Close()
			dbfail(w)
			return
		}
		out = append(out, map[string]any{"candidate_id": id, "title": title, "category": category, "rank": len(out) + 1, "explanations": []string{"Public text terms overlap."}})
	}
	rowsErr = rows.Err()
	rows.Close()
	if rowsErr != nil {
		dbfail(w)
		return
	}
	if err := fallbackTx.Commit(r.Context()); err != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusOK, envelope{"data": map[string]any{"source": "text_search", "suggestions": out, "notice": "Text matches are leads only; an authorized staff reviewer must verify records independently.", "decision": "staff_review_required"}})
}

func validMatchFilters(category string, maxDaysApart int) bool {
	if utf8.RuneCountInString(strings.TrimSpace(category)) > 80 {
		return false
	}
	return maxDaysApart == 0 || maxDaysApart == 7 || maxDaysApart == 30 || maxDaysApart == 90
}

func oneOf(s string, a ...string) bool {
	for _, x := range a {
		if s == x {
			return true
		}
	}
	return false
}
func dbfail(w http.ResponseWriter) {
	log.Print("database operation failed")
	fail(w, 503, "database_error", "database operation unavailable")
}
