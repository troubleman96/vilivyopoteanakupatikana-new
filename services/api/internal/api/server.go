package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/auth"
	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/store"
)

type Server struct {
	DB                 *store.Store
	Auth               auth.Validator
	Demo               bool
	AIURL              string
	AIToken            string
	AIMatchingEnabled  bool
	CORSAllowedOrigins []string
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

var institutions = []map[string]any{{"id": "example-university", "name": "Example University", "region": "Dar es Salaam", "active": true}}
var fixtures = []Item{{ID: "sample-item-001", InstitutionID: "example-university", InstitutionName: "Example University", Category: "electronics", Title: "Black water bottle", Description: "Black reusable water bottle found near the library.", Location: "Library entrance", OccurredOn: "2025-02-12", Status: "found", ReviewStatus: "approved"}, {ID: "sample-item-002", InstitutionID: "example-university", InstitutionName: "Example University", Category: "accessories", Title: "Blue umbrella", Description: "Foldable blue umbrella reported missing.", Location: "Student commons", OccurredOn: "2025-02-14", Status: "lost", ReviewStatus: "approved"}, {ID: "private-draft", InstitutionID: "example-university", InstitutionName: "Example University", Category: "identity", Title: "Unreviewed card", Description: "DO NOT PUBLISH", Location: "Office", Status: "found", ReviewStatus: "pending"}}

var (
	emailPattern = regexp.MustCompile(`\b[^\s@]+@[^\s@]+\.[^\s@]+\b`)
	phonePattern = regexp.MustCompile(`\+?[0-9][0-9 .()/-]{7,}[0-9]`)
)

func New(db *store.Store, v auth.Validator, demo bool, ai string) *Server {
	s := &Server{DB: db, Auth: v, Demo: demo, AIURL: ai, mux: http.NewServeMux()}
	s.routes()
	return s
}
func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
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
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
	}
	if r.Method == http.MethodOptions {
		if allowed {
			w.WriteHeader(http.StatusNoContent)
		} else {
			fail(w, http.StatusForbidden, "cors_denied", "origin is not allowed")
		}
		return
	}
	s.mux.ServeHTTP(w, r)
}
func (s *Server) routes() {
	s.mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { write(w, 200, envelope{"status": "ok"}) })
	s.mux.HandleFunc("GET /readyz", s.ready)
	s.mux.HandleFunc("POST /api/v1/auth/register", s.registerAccount)
	s.mux.HandleFunc("POST /api/v1/auth/login", s.signIn)
	s.mux.HandleFunc("POST /api/v1/auth/logout", s.signOut)
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
	s.mux.HandleFunc("GET /api/v1/staff/institutions/{institutionID}/cases", s.staffCases)
	s.mux.HandleFunc("GET /api/v1/staff/institutions/{institutionID}/claims", s.staffClaims)
	s.mux.HandleFunc("PATCH /api/v1/staff/institutions/{institutionID}/cases/{caseID}", s.updateCase)
	s.mux.HandleFunc("POST /api/v1/staff/institutions/{institutionID}/claims/{claimID}/review", s.reviewClaim)
	s.mux.HandleFunc("POST /api/v1/staff/institutions/{institutionID}/items/{itemID}/review", s.reviewItem)
	s.mux.HandleFunc("POST /api/v1/staff/institutions/{institutionID}/cases/{caseID}/handover", s.handover)
	s.mux.HandleFunc("GET /api/v1/institutions/{institutionID}/stats", s.institutionStats)
	s.mux.HandleFunc("GET /api/v1/platform/stats", s.platformStats)
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
	if s.DB == nil {
		if s.Demo {
			write(w, 200, envelope{"status": "ready", "mode": "demo-read-only"})
			return
		}
		fail(w, 503, "not_ready", "database is not configured")
		return
	}
	if e := s.DB.Pool.Ping(r.Context()); e != nil {
		fail(w, 503, "not_ready", "database unavailable")
		return
	}
	write(w, 200, envelope{"status": "ready"})
}
func (s *Server) listInstitutions(w http.ResponseWriter, r *http.Request) {
	if s.DB == nil {
		if s.Demo {
			write(w, 200, envelope{"data": institutions})
			return
		}
		fail(w, 503, "unavailable", "database is not configured")
		return
	}
	rows, e := s.DB.Pool.Query(r.Context(), `SELECT id::text,name,region FROM institutions WHERE active=true ORDER BY name`)
	if e != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, n, reg string
		if rows.Scan(&id, &n, &reg) == nil {
			out = append(out, map[string]any{"id": id, "name": n, "region": reg})
		}
	}
	write(w, 200, envelope{"data": out})
}
func (s *Server) getInstitution(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("institutionID")
	if s.DB == nil && s.Demo && id == "example-university" {
		write(w, 200, envelope{"data": institutions[0]})
		return
	}
	if s.DB == nil {
		fail(w, 503, "unavailable", "database is not configured")
		return
	}
	var n, reg string
	e := s.DB.Pool.QueryRow(r.Context(), `SELECT name,region FROM institutions WHERE id::text=$1 AND active=true`, id).Scan(&n, &reg)
	if e != nil {
		fail(w, 404, "not_found", "institution not found")
		return
	}
	write(w, 200, envelope{"data": map[string]any{"id": id, "name": n, "region": reg}})
}
func publicItem(x Item) map[string]any {
	kind := x.Kind
	if kind == "" && (x.Status == "found" || x.Status == "lost") {
		kind = x.Status
	}
	return map[string]any{"id": x.ID, "institution_id": x.InstitutionID, "institution_name": x.InstitutionName, "category": x.Category, "title": x.Title, "description": x.Description, "location": x.Location, "occurred_on": x.OccurredOn, "kind": kind, "status": x.Status}
}
func (s *Server) listItems(w http.ResponseWriter, r *http.Request) {
	if s.DB == nil {
		if !s.Demo {
			fail(w, 503, "unavailable", "database is not configured")
			return
		}
		o := []map[string]any{}
		q := strings.ToLower(r.URL.Query().Get("q"))
		for _, x := range fixtures {
			if x.ReviewStatus == "approved" && (q == "" || strings.Contains(strings.ToLower(x.Title+" "+x.Description+" "+x.Category), q)) {
				o = append(o, publicItem(x))
			}
		}
		write(w, 200, envelope{"data": o})
		return
	}
	rows, e := s.DB.Pool.Query(r.Context(), `SELECT i.id::text,i.institution_id::text,u.name,i.category,i.public_title,i.public_description,i.public_location,COALESCE(i.occurred_on::text,''),i.kind,i.status FROM items i JOIN institutions u ON u.id=i.institution_id WHERE i.review_status='approved' AND i.visibility='public' AND i.status NOT IN ('returned','closed') AND u.active=true AND ($1='' OR to_tsvector('simple',coalesce(i.public_title,'')||' '||coalesce(i.public_description,'')||' '||coalesce(i.category,'')) @@ plainto_tsquery('simple',$1)) ORDER BY i.created_at DESC LIMIT 100`, r.URL.Query().Get("q"))
	if e != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	o := []map[string]any{}
	for rows.Next() {
		var x Item
		if rows.Scan(&x.ID, &x.InstitutionID, &x.InstitutionName, &x.Category, &x.Title, &x.Description, &x.Location, &x.OccurredOn, &x.Kind, &x.Status) == nil {
			o = append(o, publicItem(x))
		}
	}
	write(w, 200, envelope{"data": o})
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

	if query != "" && s.AIMatchingEnabled && s.AIURL != "" {
		candidates, err := s.publicSearchCandidates(r, kind, category, institutionID)
		if err == nil {
			queryRecord := aiRecord{RecordID: "public-search-query", Category: category, Description: query}
			aiCandidates := make([]aiRecord, 0, len(candidates))
			byID := make(map[string]Item, len(candidates))
			for _, candidate := range candidates {
				aiCandidates = append(aiCandidates, aiRecordForPublicItem(candidate))
				byID[candidate.ID] = candidate
			}
			if result, matchErr := s.callMatchService(r.Context(), queryRecord, aiCandidates); matchErr == nil {
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
	}

	if s.DB == nil {
		if !s.Demo {
			fail(w, http.StatusServiceUnavailable, "unavailable", "database is not configured")
			return
		}
		items := make([]map[string]any, 0, len(fixtures))
		for _, item := range fixtures {
			if item.ReviewStatus != "approved" || (kind != "" && item.Kind != kind) || (category != "" && item.Category != category) || (institutionID != "" && item.InstitutionID != institutionID) {
				continue
			}
			text := strings.ToLower(item.Title + " " + item.Description + " " + item.Category + " " + item.Location)
			if query == "" || strings.Contains(text, strings.ToLower(query)) {
				items = append(items, publicItem(item))
			}
		}
		write(w, http.StatusOK, envelope{"data": map[string]any{"source": "text_search", "items": items, "notice": "Showing reviewed public summaries using text search."}})
		return
	}

	rows, err := s.DB.Pool.Query(r.Context(), `SELECT i.id::text,i.institution_id::text,u.name,i.category,i.public_title,i.public_description,i.public_location,COALESCE(i.occurred_on::text,''),i.kind,i.status FROM items i JOIN institutions u ON u.id=i.institution_id WHERE i.review_status='approved' AND i.visibility='public' AND i.status NOT IN ('returned','closed') AND u.active=true AND ($1='' OR to_tsvector('simple',coalesce(i.public_title,'')||' '||coalesce(i.public_description,'')||' '||coalesce(i.category,'')) @@ plainto_tsquery('simple',$1)) AND ($2='' OR i.kind=$2) AND ($3='' OR i.category=$3) AND ($4='' OR i.institution_id::text=$4) ORDER BY i.created_at DESC LIMIT 100`, query, kind, category, institutionID)
	if err != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var item Item
		if rows.Scan(&item.ID, &item.InstitutionID, &item.InstitutionName, &item.Category, &item.Title, &item.Description, &item.Location, &item.OccurredOn, &item.Kind, &item.Status) == nil {
			items = append(items, publicItem(item))
		}
	}
	if rows.Err() != nil {
		dbfail(w)
		return
	}
	write(w, http.StatusOK, envelope{"data": map[string]any{"source": "text_search", "items": items, "notice": "Showing reviewed public summaries using text search."}})
}

func (s *Server) publicSearchCandidates(r *http.Request, kind, category, institutionID string) ([]Item, error) {
	if s.DB == nil {
		if !s.Demo {
			return nil, errors.New("database is not configured")
		}
		items := make([]Item, 0, len(fixtures))
		for _, item := range fixtures {
			if item.ReviewStatus == "approved" && (kind == "" || item.Kind == kind) && (category == "" || item.Category == category) && (institutionID == "" || item.InstitutionID == institutionID) {
				items = append(items, item)
			}
		}
		return items, nil
	}
	rows, err := s.DB.Pool.Query(r.Context(), `SELECT i.id::text,i.institution_id::text,u.name,i.category,i.public_title,i.public_description,i.public_location,COALESCE(i.occurred_on::text,''),i.kind,i.status FROM items i JOIN institutions u ON u.id=i.institution_id WHERE i.review_status='approved' AND i.visibility='public' AND i.status NOT IN ('returned','closed') AND u.active=true AND ($1='' OR i.kind=$1) AND ($2='' OR i.category=$2) AND ($3='' OR i.institution_id::text=$3) ORDER BY i.created_at DESC LIMIT 50`, kind, category, institutionID)
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
	id := r.PathValue("itemID")
	if s.DB == nil {
		if s.Demo {
			for _, x := range fixtures {
				if x.ID == id && x.ReviewStatus == "approved" {
					write(w, 200, envelope{"data": publicItem(x)})
					return
				}
			}
			fail(w, 404, "not_found", "item not found")
			return
		}
		fail(w, 503, "unavailable", "database is not configured")
		return
	}
	var x Item
	e := s.DB.Pool.QueryRow(r.Context(), `SELECT i.id::text,i.institution_id::text,u.name,i.category,i.public_title,i.public_description,i.public_location,COALESCE(i.occurred_on::text,''),i.kind,i.status FROM items i JOIN institutions u ON u.id=i.institution_id WHERE i.id::text=$1 AND i.review_status='approved' AND i.visibility='public' AND i.status NOT IN ('returned','closed') AND u.active=true`, id).Scan(&x.ID, &x.InstitutionID, &x.InstitutionName, &x.Category, &x.Title, &x.Description, &x.Location, &x.OccurredOn, &x.Kind, &x.Status)
	if e != nil {
		fail(w, 404, "not_found", "item not found")
		return
	}
	write(w, 200, envelope{"data": publicItem(x)})
}

type identity struct{ ID string }

func (s *Server) private(w http.ResponseWriter, r *http.Request) (identity, bool) {
	u, e := s.Auth.Validate(r.Context(), r.Header.Get("Authorization"))
	if e != nil {
		if errors.Is(e, auth.ErrNotConfigured) {
			fail(w, 503, "auth_unavailable", "authentication is not configured")
		} else if errors.Is(e, auth.ErrUnauthenticated) {
			fail(w, 401, "unauthorized", "a valid bearer token is required")
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
	var b struct {
		InstitutionID string `json:"institution_id"`
		Kind          string `json:"kind"`
		Category      string `json:"category"`
		Title         string `json:"title"`
		Description   string `json:"description"`
		Location      string `json:"location"`
		OccurredOn    string `json:"occurred_on"`
		Contact       string `json:"contact_details"`
	}
	if body(r, &b) != nil || b.InstitutionID == "" || b.Title == "" || (b.Kind != "lost" && b.Kind != "found") {
		fail(w, 400, "invalid_request", "institution_id, title, and kind (lost or found) are required")
		return
	}
	tx, e := s.DB.Pool.Begin(r.Context())
	if e != nil {
		dbfail(w)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	id := ""
	e = tx.QueryRow(r.Context(), `INSERT INTO items (institution_id,reporter_id,kind,category,private_title,private_description,private_location,occurred_on,contact_details,status,review_status,visibility) SELECT id,$2,$3,$4,$5,$6,$7,NULLIF($8,'')::date,$9,'open','pending','private' FROM institutions WHERE id::text=$1 AND active=true RETURNING id::text`, b.InstitutionID, u.ID, b.Kind, b.Category, b.Title, b.Description, b.Location, b.OccurredOn, b.Contact).Scan(&id)
	if e != nil {
		fail(w, 400, "invalid_institution", "institution unavailable or report invalid")
		return
	}
	_, e = tx.Exec(r.Context(), `INSERT INTO cases(item_id,institution_id,status) SELECT id,institution_id,'open' FROM items WHERE id::text=$1`, id)
	if e != nil {
		dbfail(w)
		return
	}
	if e = tx.Commit(r.Context()); e != nil {
		dbfail(w)
		return
	}
	write(w, 201, envelope{"data": map[string]string{"id": id, "status": "submitted_for_review"}})
}
func (s *Server) myReports(w http.ResponseWriter, r *http.Request) {
	u, ok := s.private(w, r)
	if !ok {
		return
	}
	rows, e := s.DB.Pool.Query(r.Context(), `SELECT id::text,kind,status,review_status,created_at FROM items WHERE reporter_id=$1 ORDER BY created_at DESC`, u.ID)
	if e != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, k, st, rv string
		var at time.Time
		if rows.Scan(&id, &k, &st, &rv, &at) == nil {
			out = append(out, map[string]any{"id": id, "kind": k, "status": st, "review_status": rv, "created_at": at})
		}
	}
	write(w, 200, envelope{"data": out})
}
func (s *Server) createClaim(w http.ResponseWriter, r *http.Request) {
	u, ok := s.private(w, r)
	if !ok {
		return
	}
	var b struct {
		ItemID    string `json:"item_id"`
		Statement string `json:"statement"`
		Contact   string `json:"contact_details"`
		Evidence  string `json:"evidence_reference"`
	}
	if body(r, &b) != nil || b.ItemID == "" || b.Statement == "" {
		fail(w, 400, "invalid_request", "item_id and statement are required")
		return
	}
	var id string
	e := s.DB.Pool.QueryRow(r.Context(), `INSERT INTO claims(item_id,claimant_id,statement,contact_details,evidence_reference,status) SELECT id,$2,$3,$4,$5,'pending' FROM items WHERE id::text=$1 AND visibility='public' AND review_status='approved' RETURNING id::text`, b.ItemID, u.ID, b.Statement, b.Contact, b.Evidence).Scan(&id)
	if e != nil {
		fail(w, 400, "invalid_item", "item unavailable or claim invalid")
		return
	}
	write(w, 201, envelope{"data": map[string]string{"id": id, "status": "pending_review"}})
}
func (s *Server) myClaims(w http.ResponseWriter, r *http.Request) {
	u, ok := s.private(w, r)
	if !ok {
		return
	}
	rows, e := s.DB.Pool.Query(r.Context(), `SELECT id::text,item_id::text,status,created_at FROM claims WHERE claimant_id=$1 ORDER BY created_at DESC`, u.ID)
	if e != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, it, st string
		var at time.Time
		if rows.Scan(&id, &it, &st, &at) == nil {
			out = append(out, map[string]any{"id": id, "item_id": it, "status": st, "created_at": at})
		}
	}
	write(w, 200, envelope{"data": out})
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
	if _, ok := s.staff(w, r); !ok {
		return
	}
	rows, e := s.DB.Pool.Query(r.Context(), `SELECT c.id::text,c.item_id::text,c.status,i.kind,i.category,i.private_title,i.private_description,i.private_location,i.review_status,i.visibility,i.public_title,i.public_description,i.public_location FROM cases c JOIN items i ON i.id=c.item_id WHERE c.institution_id::text=$1 ORDER BY c.created_at DESC`, r.PathValue("institutionID"))
	if e != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, it, st, k, category, t, d, l, reviewStatus, visibility, publicTitle, publicDescription, publicLocation string
		if rows.Scan(&id, &it, &st, &k, &category, &t, &d, &l, &reviewStatus, &visibility, &publicTitle, &publicDescription, &publicLocation) == nil {
			out = append(out, map[string]any{"id": id, "item_id": it, "status": st, "kind": k, "category": category, "private_title": t, "private_description": d, "private_location": l, "review_status": reviewStatus, "visibility": visibility, "public_title": publicTitle, "public_description": publicDescription, "public_location": publicLocation})
		}
	}
	write(w, 200, envelope{"data": out})
}

func (s *Server) staffClaims(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.staff(w, r); !ok {
		return
	}
	rows, e := s.DB.Pool.Query(r.Context(), `SELECT c.id::text,c.item_id::text,c.claimant_id::text,c.statement,c.contact_details,c.evidence_reference,c.status,c.created_at FROM claims c JOIN items i ON i.id=c.item_id WHERE i.institution_id::text=$1 ORDER BY c.created_at DESC LIMIT 100`, r.PathValue("institutionID"))
	if e != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, itemID, claimantID, statement, contact, evidence, status string
		var createdAt time.Time
		if rows.Scan(&id, &itemID, &claimantID, &statement, &contact, &evidence, &status, &createdAt) == nil {
			out = append(out, map[string]any{"id": id, "item_id": itemID, "claimant_id": claimantID, "statement": statement, "contact_details": contact, "evidence_reference": evidence, "status": status, "created_at": createdAt})
		}
	}
	if rows.Err() != nil {
		dbfail(w)
		return
	}
	write(w, 200, envelope{"data": out})
}
func (s *Server) reviewItem(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.staff(w, r); !ok {
		return
	}
	var b struct {
		Status            string `json:"status"`
		PublicTitle       string `json:"public_title"`
		PublicDescription string `json:"public_description"`
		PublicLocation    string `json:"public_location"`
	}
	if body(r, &b) != nil || (b.Status != "approved" && b.Status != "rejected") || (b.Status == "approved" && (strings.TrimSpace(b.PublicTitle) == "" || len(b.PublicTitle) > 120 || len(b.PublicDescription) > 2000 || len(b.PublicLocation) > 120 || hasContactDetails(b.PublicTitle+" "+b.PublicDescription+" "+b.PublicLocation))) {
		fail(w, 400, "invalid_request", "approval requires a safe public title, description, and location without contact details")
		return
	}
	visibility := "private"
	if b.Status == "approved" {
		visibility = "public"
	}
	tag, e := s.DB.Pool.Exec(r.Context(), `UPDATE items SET review_status=$1,visibility=$2,public_title=$3,public_description=$4,public_location=$5 WHERE id::text=$6 AND institution_id::text=$7`, b.Status, visibility, b.PublicTitle, b.PublicDescription, b.PublicLocation, r.PathValue("itemID"), r.PathValue("institutionID"))
	if e != nil {
		dbfail(w)
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, 404, "not_found", "item not found")
		return
	}
	write(w, 200, envelope{"data": map[string]string{"review_status": b.Status, "visibility": visibility}})
}

func (s *Server) updateCase(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.staff(w, r); !ok {
		return
	}
	var b struct {
		Status string `json:"status"`
	}
	if body(r, &b) != nil || !oneOf(b.Status, "open", "under_review", "matched", "closed") {
		fail(w, 400, "invalid_request", "status must be open, under_review, matched, or closed; use the verified handover endpoint to record a return")
		return
	}
	tag, e := s.DB.Pool.Exec(r.Context(), `UPDATE cases SET status=$1,updated_at=now() WHERE id::text=$2 AND institution_id::text=$3`, b.Status, r.PathValue("caseID"), r.PathValue("institutionID"))
	if e != nil {
		dbfail(w)
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, 404, "not_found", "case not found")
		return
	}
	write(w, 200, envelope{"data": map[string]string{"status": b.Status}})
}
func (s *Server) reviewClaim(w http.ResponseWriter, r *http.Request) {
	if _, ok := s.staff(w, r); !ok {
		return
	}
	var b struct {
		Status    string `json:"status"`
		StaffNote string `json:"staff_note"`
	}
	if body(r, &b) != nil || !oneOf(b.Status, "approved", "rejected", "needs_information") {
		fail(w, 400, "invalid_request", "status must be approved, rejected, or needs_information")
		return
	}
	tag, e := s.DB.Pool.Exec(r.Context(), `UPDATE claims SET status=$1,staff_note=$2,reviewed_at=now() FROM items i WHERE claims.item_id=i.id AND claims.id::text=$3 AND i.institution_id::text=$4`, b.Status, b.StaffNote, r.PathValue("claimID"), r.PathValue("institutionID"))
	if e != nil {
		dbfail(w)
		return
	}
	if tag.RowsAffected() == 0 {
		fail(w, 404, "not_found", "claim not found")
		return
	}
	write(w, 200, envelope{"data": map[string]string{"status": b.Status}})
}
func (s *Server) handover(w http.ResponseWriter, r *http.Request) {
	u, ok := s.staff(w, r)
	if !ok {
		return
	}
	var b struct {
		ClaimID    string `json:"claim_id"`
		HandoverAt string `json:"handover_at"`
		Details    string `json:"details"`
		Recipient  string `json:"recipient"`
	}
	if body(r, &b) != nil || b.HandoverAt == "" || b.ClaimID == "" {
		fail(w, 400, "invalid_request", "claim_id and handover_at are required")
		return
	}
	tx, e := s.DB.Pool.Begin(r.Context())
	if e != nil {
		dbfail(w)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	var itemID, caseStatus string
	e = tx.QueryRow(r.Context(), `SELECT item_id::text,status FROM cases WHERE id::text=$1 AND institution_id::text=$2 FOR UPDATE`, r.PathValue("caseID"), r.PathValue("institutionID")).Scan(&itemID, &caseStatus)
	if errors.Is(e, pgx.ErrNoRows) {
		fail(w, 404, "not_found", "case not found")
		return
	}
	if e != nil {
		dbfail(w)
		return
	}
	if caseStatus != "matched" {
		fail(w, 409, "handover_not_ready", "the case must be matched before a handover can be recorded")
		return
	}
	var claimApproved bool
	e = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM claims WHERE id::text=$1 AND item_id::text=$2 AND status='approved')`, b.ClaimID, itemID).Scan(&claimApproved)
	if e != nil {
		dbfail(w)
		return
	}
	if !claimApproved {
		fail(w, 409, "handover_not_verified", "a staff-approved claim for this case is required before handover")
		return
	}
	var alreadyRecorded bool
	e = tx.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM handovers WHERE case_id::text=$1)`, r.PathValue("caseID")).Scan(&alreadyRecorded)
	if e != nil {
		dbfail(w)
		return
	}
	if alreadyRecorded {
		fail(w, 409, "handover_already_recorded", "this case already has a recorded handover")
		return
	}
	_, e = tx.Exec(r.Context(), `INSERT INTO handovers(case_id,institution_id,claim_id,recorded_by,handover_at,details,recipient) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::timestamptz,$6,$7)`, r.PathValue("caseID"), r.PathValue("institutionID"), b.ClaimID, u.ID, b.HandoverAt, b.Details, b.Recipient)
	if e != nil {
		dbfail(w)
		return
	}
	tag, e := tx.Exec(r.Context(), `UPDATE cases SET status='returned',updated_at=now() WHERE id::text=$1 AND institution_id::text=$2`, r.PathValue("caseID"), r.PathValue("institutionID"))
	if e != nil || tag.RowsAffected() == 0 {
		dbfail(w)
		return
	}
	_, e = tx.Exec(r.Context(), `UPDATE items SET status='returned' WHERE id=(SELECT item_id FROM cases WHERE id::text=$1 AND institution_id::text=$2)`, r.PathValue("caseID"), r.PathValue("institutionID"))
	if e != nil {
		dbfail(w)
		return
	}
	if e = tx.Commit(r.Context()); e != nil {
		dbfail(w)
		return
	}
	write(w, 201, envelope{"data": map[string]string{"status": "recorded_privately"}})
}
func (s *Server) institutionStats(w http.ResponseWriter, r *http.Request) {
	u, ok := s.private(w, r)
	if !ok {
		return
	}
	id := r.PathValue("institutionID")
	allowed, e := s.DB.Member(r.Context(), u.ID, id)
	if e != nil {
		dbfail(w)
		return
	}
	if !allowed {
		fail(w, 403, "forbidden", "institution membership required")
		return
	}
	m, e := s.DB.InstitutionStats(r.Context(), id)
	if e != nil {
		dbfail(w)
		return
	}
	write(w, 200, envelope{"data": m})
}
func (s *Server) platformStats(w http.ResponseWriter, r *http.Request) {
	u, ok := s.private(w, r)
	if !ok {
		return
	}
	yes, e := s.DB.PlatformAdmin(r.Context(), u.ID)
	if e != nil {
		dbfail(w)
		return
	}
	if !yes {
		fail(w, 403, "forbidden", "platform administrator required")
		return
	}
	m, e := s.DB.PlatformStats(r.Context())
	if e != nil {
		dbfail(w)
		return
	}
	write(w, 200, envelope{"data": m})
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
	ctx, cancel := context.WithTimeout(parent, 8*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(s.AIURL, "/")+"/v1/matches", bytes.NewReader(encoded))
	if err != nil {
		return aiMatchResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	if s.AIToken != "" {
		req.Header.Set("Authorization", "Bearer "+s.AIToken)
	}
	resp, err := (&http.Client{Timeout: 8 * time.Second}).Do(req)
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
	if _, ok := s.staff(w, r); !ok {
		return
	}
	var b struct {
		ItemID string `json:"item_id"`
	}
	if body(r, &b) != nil || strings.TrimSpace(b.ItemID) == "" {
		fail(w, 400, "invalid_request", "item_id is required")
		return
	}
	institutionID := r.PathValue("institutionID")
	var query aiRecord
	var itemKind string
	e := s.DB.Pool.QueryRow(r.Context(), `SELECT id::text,category,concat_ws(' ',NULLIF(public_title,''),NULLIF(public_description,'')),COALESCE(occurred_on::text,''),public_location,kind FROM items WHERE id::text=$1 AND institution_id::text=$2 AND review_status='approved' AND visibility='public' AND status NOT IN ('returned','closed')`, b.ItemID, institutionID).Scan(&query.RecordID, &query.Category, &query.Description, &query.ObservedDate, &query.Location, &itemKind)
	if errors.Is(e, pgx.ErrNoRows) {
		fail(w, 404, "not_found", "reviewed public item not found")
		return
	}
	if e != nil {
		dbfail(w)
		return
	}
	rows, e := s.DB.Pool.Query(r.Context(), `SELECT id::text,category,concat_ws(' ',NULLIF(public_title,''),NULLIF(public_description,'')),COALESCE(occurred_on::text,''),public_location,public_title FROM items WHERE institution_id::text=$1 AND id::text<>$2 AND kind<>$3 AND review_status='approved' AND visibility='public' AND status NOT IN ('returned','closed') ORDER BY created_at DESC LIMIT 50`, institutionID, b.ItemID, itemKind)
	if e != nil {
		dbfail(w)
		return
	}
	candidates := []aiRecord{}
	candidateDetails := map[string]map[string]string{}
	for rows.Next() {
		var candidate aiRecord
		var title string
		if rows.Scan(&candidate.RecordID, &candidate.Category, &candidate.Description, &candidate.ObservedDate, &candidate.Location, &title) == nil {
			candidates = append(candidates, candidate)
			candidateDetails[candidate.RecordID] = map[string]string{"title": title, "category": candidate.Category}
		}
	}
	rowErr := rows.Err()
	rows.Close()
	if rowErr != nil {
		dbfail(w)
		return
	}
	if result, matchErr := s.callMatchService(r.Context(), query, candidates); matchErr == nil {
		suggestions := make([]map[string]any, 0, len(result.Suggestions))
		for _, suggestion := range result.Suggestions {
			if detail, ok := candidateDetails[suggestion.CandidateID]; ok {
				suggestions = append(suggestions, map[string]any{"candidate_id": suggestion.CandidateID, "title": detail["title"], "category": detail["category"], "rank": suggestion.Rank, "signal": suggestion.Signal, "explanations": suggestion.Explanations})
			}
		}
		write(w, http.StatusOK, envelope{"data": map[string]any{"source": rankingSource(result.Ranking), "suggestions": suggestions, "ranking": result.Ranking, "notice": result.Notice, "decision": "staff_review_required"}})
		return
	}
	textQuery := strings.TrimSpace(query.Category + " " + query.Description)
	rows, e = s.DB.Pool.Query(r.Context(), `SELECT id::text,public_title,category FROM items WHERE institution_id::text=$2 AND id::text<>$3 AND kind<>$4 AND review_status='approved' AND visibility='public' AND status NOT IN ('returned','closed') AND ($1='' OR to_tsvector('simple',coalesce(public_title,'')||' '||coalesce(public_description,'')||' '||coalesce(category,'')) @@ plainto_tsquery('simple',$1)) ORDER BY created_at DESC LIMIT 10`, textQuery, institutionID, b.ItemID, itemKind)
	if e != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, title, category string
		if rows.Scan(&id, &title, &category) == nil {
			out = append(out, map[string]any{"candidate_id": id, "title": title, "category": category, "rank": len(out) + 1, "explanations": []string{"Public text terms overlap."}})
		}
	}
	if rows.Err() != nil {
		dbfail(w)
		return
	}
	write(w, 200, envelope{"data": map[string]any{"source": "text_search", "suggestions": out, "notice": "Text matches are leads only; an authorized staff reviewer must verify records independently.", "decision": "staff_review_required"}})
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
