package api

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

func (s *Server) staffInstitutions(w http.ResponseWriter, r *http.Request) {
	user, ok := s.private(w, r)
	if !ok {
		return
	}
	tx, err := s.DB.BeginUser(r.Context(), user.ID)
	if err != nil {
		dbfail(w)
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	rows, err := tx.Query(r.Context(), `SELECT i.id::text,i.name,i.region FROM institution_memberships m JOIN institutions i ON i.id=m.institution_id WHERE m.user_id=$1::uuid AND m.active=true AND i.active=true ORDER BY i.name`, user.ID)
	if err != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	type institution struct {
		ID     string `json:"id"`
		Name   string `json:"name"`
		Region string `json:"region"`
	}
	out := []institution{}
	for rows.Next() {
		var item institution
		if err := rows.Scan(&item.ID, &item.Name, &item.Region); err != nil {
			dbfail(w)
			return
		}
		out = append(out, item)
	}
	if rows.Err() != nil {
		dbfail(w)
		return
	}
	commitWithData(w, r, tx, out, http.StatusOK)
}

func (s *Server) platformTransaction(w http.ResponseWriter, r *http.Request) (identity, pgx.Tx, bool) {
	user, ok := s.private(w, r)
	if !ok {
		return identity{}, nil, false
	}
	tx, err := s.DB.BeginUser(r.Context(), user.ID)
	if err != nil {
		dbfail(w)
		return identity{}, nil, false
	}
	var allowed bool
	if err = tx.QueryRow(r.Context(), `SELECT EXISTS (SELECT 1 FROM platform_admins WHERE user_id=$1 AND active=true)`, user.ID).Scan(&allowed); err != nil {
		_ = tx.Rollback(r.Context())
		dbfail(w)
		return identity{}, nil, false
	}
	if !allowed {
		_ = tx.Rollback(r.Context())
		fail(w, http.StatusForbidden, "forbidden", "platform administrator required")
		return identity{}, nil, false
	}
	if _, err = tx.Exec(r.Context(), `SELECT set_config('app.platform_admin','true',true)`); err != nil {
		_ = tx.Rollback(r.Context())
		dbfail(w)
		return identity{}, nil, false
	}
	return user, tx, true
}

func commitWithData(w http.ResponseWriter, r *http.Request, tx pgx.Tx, data any, status int) {
	if err := tx.Commit(r.Context()); err != nil {
		dbfail(w)
		return
	}
	write(w, status, envelope{"data": data})
}

func recordPlatformEvent(r *http.Request, tx pgx.Tx, actor identity, action, targetType, targetID string, details map[string]any) error {
	payload, err := json.Marshal(details)
	if err != nil {
		return err
	}
	_, err = tx.Exec(r.Context(), `INSERT INTO platform_admin_events(actor_user_id,action,target_type,target_id,details) VALUES($1::uuid,$2,$3,$4,$5::jsonb)`, actor.ID, action, targetType, targetID, string(payload))
	return err
}

func (s *Server) platformInstitutions(w http.ResponseWriter, r *http.Request) {
	user, tx, ok := s.platformTransaction(w, r)
	if !ok {
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	rows, err := tx.Query(r.Context(), `SELECT i.id::text,i.name,i.region,i.active,i.created_at::text,count(DISTINCT m.user_id) FILTER (WHERE m.active),count(DISTINCT c.id) FILTER (WHERE c.status NOT IN ('returned','closed')) FROM institutions i LEFT JOIN institution_memberships m ON m.institution_id=i.id LEFT JOIN cases c ON c.institution_id=i.id GROUP BY i.id ORDER BY i.name`)
	if err != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	type rowType struct {
		ID        string `json:"id"`
		Name      string `json:"name"`
		Region    string `json:"region"`
		Active    bool   `json:"active"`
		CreatedAt string `json:"created_at"`
		Members   int    `json:"members"`
		OpenCases int    `json:"open_cases"`
	}
	out := []rowType{}
	for rows.Next() {
		var item rowType
		if err = rows.Scan(&item.ID, &item.Name, &item.Region, &item.Active, &item.CreatedAt, &item.Members, &item.OpenCases); err != nil {
			dbfail(w)
			return
		}
		out = append(out, item)
	}
	if rows.Err() != nil {
		dbfail(w)
		return
	}
	_ = user
	commitWithData(w, r, tx, out, http.StatusOK)
}

func (s *Server) createPlatformInstitution(w http.ResponseWriter, r *http.Request) {
	user, tx, ok := s.platformTransaction(w, r)
	if !ok {
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	var input struct {
		Name   string `json:"name"`
		Region string `json:"region"`
	}
	if body(r, &input) != nil {
		fail(w, 400, "invalid_request", "name and region are required")
		return
	}
	input.Name = strings.TrimSpace(input.Name)
	input.Region = strings.TrimSpace(input.Region)
	if input.Name == "" || len(input.Name) > 180 || len(input.Region) > 160 {
		fail(w, 400, "invalid_request", "name (1–180 characters) and region (up to 160 characters) are required")
		return
	}
	var id string
	if err := tx.QueryRow(r.Context(), `INSERT INTO institutions(name,region) VALUES($1,$2) RETURNING id::text`, input.Name, input.Region).Scan(&id); err != nil {
		dbfail(w)
		return
	}
	if err := recordPlatformEvent(r, tx, user, "institution.created", "institution", id, map[string]any{"name": input.Name}); err != nil {
		dbfail(w)
		return
	}
	commitWithData(w, r, tx, map[string]string{"id": id}, http.StatusCreated)
}

func (s *Server) updatePlatformInstitution(w http.ResponseWriter, r *http.Request) {
	user, tx, ok := s.platformTransaction(w, r)
	if !ok {
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	var input struct {
		Name   *string `json:"name"`
		Region *string `json:"region"`
		Active *bool   `json:"active"`
	}
	if body(r, &input) != nil || (input.Name == nil && input.Region == nil && input.Active == nil) {
		fail(w, 400, "invalid_request", "provide name, region, or active")
		return
	}
	var name, region string
	var active bool
	err := tx.QueryRow(r.Context(), `UPDATE institutions SET name=COALESCE($2,name),region=COALESCE($3,region),active=COALESCE($4,active) WHERE id::text=$1 RETURNING name,region,active`, r.PathValue("institutionID"), input.Name, input.Region, input.Active).Scan(&name, &region, &active)
	if err == pgx.ErrNoRows {
		fail(w, 404, "not_found", "institution not found")
		return
	}
	if err != nil {
		dbfail(w)
		return
	}
	if err = recordPlatformEvent(r, tx, user, "institution.updated", "institution", r.PathValue("institutionID"), map[string]any{"name": name, "region": region, "active": active}); err != nil {
		dbfail(w)
		return
	}
	commitWithData(w, r, tx, map[string]any{"name": name, "region": region, "active": active}, http.StatusOK)
}

func (s *Server) platformMemberships(w http.ResponseWriter, r *http.Request) {
	_, tx, ok := s.platformTransaction(w, r)
	if !ok {
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	rows, err := tx.Query(r.Context(), `SELECT m.user_id::text,u.email,m.role,m.active FROM institution_memberships m JOIN app_users u ON u.id=m.user_id WHERE m.institution_id::text=$1 ORDER BY u.email`, r.PathValue("institutionID"))
	if err != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	type entry struct {
		UserID string `json:"user_id"`
		Email  string `json:"email"`
		Role   string `json:"role"`
		Active bool   `json:"active"`
	}
	out := []entry{}
	for rows.Next() {
		var e entry
		if err = rows.Scan(&e.UserID, &e.Email, &e.Role, &e.Active); err != nil {
			dbfail(w)
			return
		}
		out = append(out, e)
	}
	if rows.Err() != nil {
		dbfail(w)
		return
	}
	commitWithData(w, r, tx, out, http.StatusOK)
}

func (s *Server) setPlatformMembership(w http.ResponseWriter, r *http.Request) {
	user, tx, ok := s.platformTransaction(w, r)
	if !ok {
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	var input struct {
		Email  string `json:"email"`
		Role   string `json:"role"`
		Active bool   `json:"active"`
	}
	if body(r, &input) != nil {
		fail(w, 400, "invalid_request", "email, role, and active are required")
		return
	}
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	if input.Email == "" || !oneOf(input.Role, "staff", "institution_admin") {
		fail(w, 400, "invalid_request", "provide a registered account email and role staff or institution_admin")
		return
	}
	var userID string
	err := tx.QueryRow(r.Context(), `SELECT id::text FROM app_users WHERE lower(email)=lower($1) AND active=true AND email_verified=true`, input.Email).Scan(&userID)
	if err == pgx.ErrNoRows {
		fail(w, 404, "account_not_found", "no active registered account matches that email")
		return
	}
	if err != nil {
		dbfail(w)
		return
	}
	_, err = tx.Exec(r.Context(), `INSERT INTO institution_memberships(user_id,institution_id,role,active) VALUES($1::uuid,$2::uuid,$3,$4) ON CONFLICT(user_id,institution_id) DO UPDATE SET role=EXCLUDED.role,active=EXCLUDED.active`, userID, r.PathValue("institutionID"), input.Role, input.Active)
	if err != nil {
		dbfail(w)
		return
	}
	if err = recordPlatformEvent(r, tx, user, "membership.updated", "membership", userID, map[string]any{"institution_id": r.PathValue("institutionID"), "role": input.Role, "active": input.Active}); err != nil {
		dbfail(w)
		return
	}
	commitWithData(w, r, tx, map[string]any{"user_id": userID, "email": input.Email, "role": input.Role, "active": input.Active}, http.StatusOK)
}

func (s *Server) platformAdmins(w http.ResponseWriter, r *http.Request) {
	_, tx, ok := s.platformTransaction(w, r)
	if !ok {
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	rows, err := tx.Query(r.Context(), `SELECT u.id::text,u.email,p.active FROM platform_admins p JOIN app_users u ON u.id=p.user_id ORDER BY u.email`)
	if err != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	type entry struct {
		UserID string `json:"user_id"`
		Email  string `json:"email"`
		Active bool   `json:"active"`
	}
	out := []entry{}
	for rows.Next() {
		var e entry
		if err = rows.Scan(&e.UserID, &e.Email, &e.Active); err != nil {
			dbfail(w)
			return
		}
		out = append(out, e)
	}
	if rows.Err() != nil {
		dbfail(w)
		return
	}
	commitWithData(w, r, tx, out, http.StatusOK)
}

func (s *Server) setPlatformAdmin(w http.ResponseWriter, r *http.Request) {
	actor, tx, ok := s.platformTransaction(w, r)
	if !ok {
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	var input struct {
		Email  string `json:"email"`
		Active bool   `json:"active"`
	}
	if body(r, &input) != nil {
		fail(w, 400, "invalid_request", "email and active are required")
		return
	}
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	if input.Email == "" {
		fail(w, 400, "invalid_request", "provide a registered account email")
		return
	}
	var targetID string
	err := tx.QueryRow(r.Context(), `SELECT id::text FROM app_users WHERE lower(email)=lower($1) AND active=true AND email_verified=true`, input.Email).Scan(&targetID)
	if err == pgx.ErrNoRows {
		fail(w, 404, "account_not_found", "no active registered account matches that email")
		return
	}
	if err != nil {
		dbfail(w)
		return
	}
	if !input.Active {
		if _, err = tx.Exec(r.Context(), `SELECT pg_advisory_xact_lock(7311401)`); err != nil {
			dbfail(w)
			return
		}
		var activeCount int
		if err = tx.QueryRow(r.Context(), `SELECT count(*) FROM platform_admins WHERE active=true`).Scan(&activeCount); err != nil {
			dbfail(w)
			return
		}
		var isActive bool
		if err = tx.QueryRow(r.Context(), `SELECT COALESCE((SELECT active FROM platform_admins WHERE user_id=$1::uuid),false)`, targetID).Scan(&isActive); err != nil {
			dbfail(w)
			return
		}
		if isActive && activeCount <= 1 {
			fail(w, 409, "last_platform_admin", "the last active platform administrator cannot be removed")
			return
		}
	}
	_, err = tx.Exec(r.Context(), `INSERT INTO platform_admins(user_id,active) VALUES($1::uuid,$2) ON CONFLICT(user_id) DO UPDATE SET active=EXCLUDED.active`, targetID, input.Active)
	if err != nil {
		dbfail(w)
		return
	}
	if err = recordPlatformEvent(r, tx, actor, "platform_admin.updated", "platform_admin", targetID, map[string]any{"active": input.Active}); err != nil {
		dbfail(w)
		return
	}
	commitWithData(w, r, tx, map[string]any{"user_id": targetID, "email": input.Email, "active": input.Active}, http.StatusOK)
}

func (s *Server) platformAuditEvents(w http.ResponseWriter, r *http.Request) {
	_, tx, ok := s.platformTransaction(w, r)
	if !ok {
		return
	}
	defer func() { _ = tx.Rollback(r.Context()) }()
	rows, err := tx.Query(r.Context(), `SELECT id::text,action,target_type,target_id,details,created_at::text,email FROM (SELECT e.id,e.action,e.target_type,e.target_id,e.details,e.created_at,u.email FROM platform_admin_events e LEFT JOIN app_users u ON u.id=e.actor_user_id UNION ALL SELECT e.id,e.action,e.target_type,e.target_id::text,e.details,e.created_at,u.email FROM operational_audit_events e LEFT JOIN app_users u ON u.id=e.actor_user_id) events ORDER BY created_at DESC LIMIT 100`)
	if err != nil {
		dbfail(w)
		return
	}
	defer rows.Close()
	type entry struct {
		ID         string         `json:"id"`
		Action     string         `json:"action"`
		TargetType string         `json:"target_type"`
		TargetID   string         `json:"target_id"`
		Details    map[string]any `json:"details"`
		CreatedAt  string         `json:"created_at"`
		ActorEmail *string        `json:"actor_email"`
	}
	out := []entry{}
	for rows.Next() {
		var e entry
		var details []byte
		if err = rows.Scan(&e.ID, &e.Action, &e.TargetType, &e.TargetID, &details, &e.CreatedAt, &e.ActorEmail); err != nil {
			dbfail(w)
			return
		}
		_ = json.Unmarshal(details, &e.Details)
		out = append(out, e)
	}
	if rows.Err() != nil {
		dbfail(w)
		return
	}
	commitWithData(w, r, tx, out, http.StatusOK)
}
