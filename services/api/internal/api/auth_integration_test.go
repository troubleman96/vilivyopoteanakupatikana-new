package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/auth"
	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/store"
)

type integrationEnvelope struct {
	Data  json.RawMessage `json:"data"`
	Error struct {
		Code string `json:"code"`
	} `json:"error"`
}

type integrationSession struct {
	AccessToken string    `json:"access_token"`
	ExpiresAt   time.Time `json:"expires_at"`
	User        auth.User `json:"user"`
}

type integrationIdentity struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

type integrationRow struct {
	ID string `json:"id"`
}

func TestFiftyLocalPostgresAccountsAndIsolation(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to an isolated local database ending in _test to run the 50-account integration suite")
	}
	parsed, err := url.Parse(databaseURL)
	if err != nil || (parsed.Hostname() != "localhost" && parsed.Hostname() != "127.0.0.1") || !strings.Contains(parsed.Path, "_test") {
		t.Fatal("TEST_DATABASE_URL must target localhost and a database name containing _test; use a dedicated disposable test database")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		t.Fatal(err)
	}
	var institutionID, publicItemID string
	if err := pool.QueryRow(ctx, `SELECT id::text FROM institutions WHERE active=true ORDER BY created_at LIMIT 1`).Scan(&institutionID); err != nil {
		t.Fatalf("apply database migrations and seed an active synthetic institution first: %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT id::text FROM items WHERE review_status='approved' AND visibility='public' ORDER BY created_at LIMIT 1`).Scan(&publicItemID); err != nil {
		t.Fatalf("apply demo seed migration for the claim isolation test: %v", err)
	}
	var otherInstitutionID string
	tag := fmt.Sprintf("auth50-%d", time.Now().UnixNano())
	if err := pool.QueryRow(ctx, `INSERT INTO institutions(name,region) VALUES($1,'Synthetic test only') RETURNING id::text`, tag+"-other").Scan(&otherInstitutionID); err != nil {
		t.Fatal(err)
	}

	server := httptest.NewServer(New(&store.Store{Pool: pool}, auth.Validator{Pool: pool}, false, ""))
	defer server.Close()
	client := server.Client()
	type account struct {
		user     auth.User
		token    string
		reportID string
		claimID  string
		email    string
		password string
	}
	accounts := make([]account, 50)
	userIDs := make([]string, 0, 50)
	defer func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cleanupCancel()
		for _, userID := range userIDs {
			_, _ = pool.Exec(cleanupCtx, `DELETE FROM handovers h USING cases c, items i WHERE h.case_id=c.id AND c.item_id=i.id AND (i.reporter_id=$1 OR h.claim_id IN (SELECT id FROM claims WHERE claimant_id=$1))`, userID)
			_, _ = pool.Exec(cleanupCtx, `DELETE FROM claims WHERE claimant_id=$1`, userID)
			_, _ = pool.Exec(cleanupCtx, `DELETE FROM cases WHERE item_id IN (SELECT id FROM items WHERE reporter_id=$1)`, userID)
			_, _ = pool.Exec(cleanupCtx, `DELETE FROM items WHERE reporter_id=$1`, userID)
			_, _ = pool.Exec(cleanupCtx, `DELETE FROM institution_memberships WHERE user_id=$1`, userID)
			_, _ = pool.Exec(cleanupCtx, `DELETE FROM app_users WHERE id=$1`, userID)
		}
		_, _ = pool.Exec(cleanupCtx, `DELETE FROM institutions WHERE id=$1`, otherInstitutionID)
	}()

	for i := range accounts {
		index := i + 1
		email := fmt.Sprintf("%s-user-%02d@example.test", tag, index)
		registrationEmail := email
		if i == 0 {
			registrationEmail = strings.ToUpper(email)
		}
		password := fmt.Sprintf("Synthetic-Account-%02d-Strong!", index)
		status, body := integrationRequest(t, client, http.MethodPost, server.URL+"/api/v1/auth/register", "", map[string]string{"email": registrationEmail, "password": password})
		if status != http.StatusCreated {
			t.Fatalf("account %d registration: status %d response %s", index, status, body)
		}
		var wrapped struct {
			Data integrationSession `json:"data"`
		}
			if err := json.Unmarshal(body, &wrapped); err != nil || wrapped.Data.AccessToken == "" || wrapped.Data.User.ID == "" {
				t.Fatalf("account %d received an invalid registration session: %s (%v)", index, body, err)
			}
			if !wrapped.Data.ExpiresAt.After(time.Now()) || wrapped.Data.ExpiresAt.After(time.Now().Add(31*24*time.Hour)) || wrapped.Data.User.Email != email {
				t.Fatalf("account %d received invalid normalized identity or session expiry: %+v", index, wrapped.Data)
			}
		accounts[i] = account{user: wrapped.Data.User, token: wrapped.Data.AccessToken, email: email, password: password}
		userIDs = append(userIDs, wrapped.Data.User.ID)
		if i == 0 {
			status, body = integrationRequest(t, client, http.MethodPost, server.URL+"/api/v1/auth/register", "", map[string]string{"email": email, "password": password})
			if status != http.StatusConflict {
				t.Fatalf("duplicate registration should be rejected: status %d response %s", status, body)
			}
			status, body = integrationRequest(t, client, http.MethodPost, server.URL+"/api/v1/auth/register", "", map[string]string{"email": tag + "-weak@example.test", "password": "too-short"})
			if status != http.StatusBadRequest {
				t.Fatalf("weak password should be rejected: status %d response %s", status, body)
			}
			status, body = integrationRequest(t, client, http.MethodPost, server.URL+"/api/v1/auth/login", "", map[string]string{"email": email, "password": "incorrect-password"})
			if status != http.StatusUnauthorized {
				t.Fatalf("incorrect password should be rejected: status %d response %s", status, body)
			}
		}

		status, body = integrationRequest(t, client, http.MethodPost, server.URL+"/api/v1/reports", wrapped.Data.AccessToken, map[string]string{
			"institution_id": institutionID,
			"kind":           "found",
			"category":       "synthetic-test",
			"title":          fmt.Sprintf("Private fixture for account %02d", index),
			"description":    "Synthetic record for 50-account ownership isolation testing.",
			"location":       "Test fixture location",
		})
		if status != http.StatusCreated {
			t.Fatalf("account %d private report: status %d response %s", index, status, body)
		}
		var report struct {
			Data integrationRow `json:"data"`
		}
		if err := json.Unmarshal(body, &report); err != nil || report.Data.ID == "" {
			t.Fatalf("account %d did not receive a report id: %s (%v)", index, body, err)
		}
		accounts[i].reportID = report.Data.ID

		status, body = integrationRequest(t, client, http.MethodPost, server.URL+"/api/v1/me/claims", wrapped.Data.AccessToken, map[string]string{
			"item_id":   publicItemID,
			"statement": fmt.Sprintf("Synthetic claim from account %02d.", index),
		})
		if status != http.StatusCreated {
			t.Fatalf("account %d private claim: status %d response %s", index, status, body)
		}
		var claim struct {
			Data integrationRow `json:"data"`
		}
		if err := json.Unmarshal(body, &claim); err != nil || claim.Data.ID == "" {
			t.Fatalf("account %d did not receive a claim id: %s (%v)", index, body, err)
		}
		accounts[i].claimID = claim.Data.ID
	}

	for i, account := range accounts {
		index := i + 1
		status, body := integrationRequest(t, client, http.MethodGet, server.URL+"/api/v1/me/reports", account.token, nil)
		if status != http.StatusOK {
			t.Fatalf("account %d own reports: status %d response %s", index, status, body)
		}
		var reports struct {
			Data []integrationRow `json:"data"`
		}
		if err := json.Unmarshal(body, &reports); err != nil || len(reports.Data) != 1 || reports.Data[0].ID != account.reportID {
			t.Fatalf("account %d saw non-owned reports or an invalid response: %s (%v)", index, body, err)
		}

		status, body = integrationRequest(t, client, http.MethodGet, server.URL+"/api/v1/me/claims", account.token, nil)
		if status != http.StatusOK {
			t.Fatalf("account %d own claims: status %d response %s", index, status, body)
		}
		var claims struct {
			Data []integrationRow `json:"data"`
		}
		if err := json.Unmarshal(body, &claims); err != nil || len(claims.Data) != 1 || claims.Data[0].ID != account.claimID {
			t.Fatalf("account %d saw non-owned claims or an invalid response: %s (%v)", index, body, err)
		}

		status, body = integrationRequest(t, client, http.MethodGet, server.URL+"/api/v1/auth/me", account.token, nil)
		var me struct {
			Data integrationIdentity `json:"data"`
		}
		if status != http.StatusOK || json.Unmarshal(body, &me) != nil || me.Data.ID != account.user.ID || me.Data.Email != account.email {
			t.Fatalf("account %d identity check failed: status %d response %s", index, status, body)
		}

		status, body = integrationRequest(t, client, http.MethodPost, server.URL+"/api/v1/auth/login", "", map[string]string{"email": account.email, "password": account.password})
		var login struct {
			Data integrationSession `json:"data"`
		}
		if status != http.StatusOK || json.Unmarshal(body, &login) != nil || login.Data.AccessToken == "" || login.Data.User.ID != account.user.ID {
			t.Fatalf("account %d login check failed: status %d response %s", index, status, body)
		}
		if login.Data.AccessToken == account.token {
			t.Fatalf("account %d login reused the registration token", index)
		}
		status, body = integrationRequest(t, client, http.MethodPost, server.URL+"/api/v1/auth/logout", login.Data.AccessToken, map[string]string{})
		if status != http.StatusOK {
			t.Fatalf("account %d logout check failed: status %d response %s", index, status, body)
		}
		status, _ = integrationRequest(t, client, http.MethodGet, server.URL+"/api/v1/auth/me", login.Data.AccessToken, nil)
		if status != http.StatusUnauthorized {
			t.Fatalf("account %d revoked token remained valid: status %d", index, status)
		}
	}

	if _, err := pool.Exec(ctx, `INSERT INTO institution_memberships(user_id,institution_id,role) VALUES($1,$2,'staff')`, accounts[0].user.ID, institutionID); err != nil {
		t.Fatal(err)
	}
	for _, test := range []struct {
		name  string
		user  int
		orgID string
		want  int
	}{{"member can read own institution", 0, institutionID, http.StatusOK}, {"member cannot read another institution", 0, otherInstitutionID, http.StatusForbidden}, {"non-member cannot read staff queue", 1, institutionID, http.StatusForbidden}} {
		status, body := integrationRequest(t, client, http.MethodGet, server.URL+"/api/v1/staff/institutions/"+test.orgID+"/cases", accounts[test.user].token, nil)
		if status != test.want {
			t.Errorf("tenant boundary %q: status %d want %d response %s", test.name, status, test.want, body)
		}
	}

	status, body := integrationRequest(t, client, http.MethodPost, server.URL+"/api/v1/staff/institutions/"+institutionID+"/cases/00000000-0000-0000-0000-000000000000", accounts[0].token, map[string]string{"status": "returned"})
	if status != http.StatusNotFound && status != http.StatusMethodNotAllowed {
		_ = body
	}

	var handoverItemID, handoverCaseID string
	if err := pool.QueryRow(ctx,
		`INSERT INTO items(institution_id,reporter_id,kind,category,private_title,private_description,public_title,public_description,review_status,visibility)
		 VALUES($1,$2,'found','test','synthetic test item','private fixture','Synthetic handover test item','Public-safe fixture','approved','public') RETURNING id::text`,
		institutionID, accounts[0].user.ID,
	).Scan(&handoverItemID); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO cases(item_id,institution_id,status) VALUES($1,$2,'open') RETURNING id::text`, handoverItemID, institutionID).Scan(&handoverCaseID); err != nil {
		t.Fatal(err)
	}
	status, body = integrationRequest(t, client, http.MethodPost, server.URL+"/api/v1/me/claims", accounts[1].token, map[string]string{"item_id": handoverItemID, "statement": "Synthetic proof for controlled handover."})
	var claim struct {
		Data integrationRow `json:"data"`
	}
	if status != http.StatusCreated || json.Unmarshal(body, &claim) != nil {
		t.Fatalf("create gated handover claim: status %d response %s", status, body)
	}
	caseURL := server.URL + "/api/v1/staff/institutions/" + institutionID + "/cases/" + handoverCaseID
	status, body = integrationRequest(t, client, http.MethodPatch, caseURL, accounts[0].token, map[string]string{"status": "returned"})
	if status != http.StatusBadRequest {
		t.Fatalf("direct return transition should require verified handover: status %d response %s", status, body)
	}
	status, body = integrationRequest(t, client, http.MethodPatch, caseURL, accounts[0].token, map[string]string{"status": "matched"})
	if status != http.StatusOK {
		t.Fatalf("prepare matched case: status %d response %s", status, body)
	}
	handoverURL := server.URL + "/api/v1/staff/institutions/" + institutionID + "/cases/" + handoverCaseID + "/handover"
	handoverPayload := map[string]string{"claim_id": claim.Data.ID, "handover_at": time.Now().UTC().Format(time.RFC3339), "details": "Synthetic verified handover.", "recipient": "Synthetic account 02"}
	status, body = integrationRequest(t, client, http.MethodPost, handoverURL, accounts[0].token, handoverPayload)
	if status != http.StatusConflict {
		t.Fatalf("handover without an approved claim should be blocked: status %d response %s", status, body)
	}
	status, body = integrationRequest(t, client, http.MethodPost, server.URL+"/api/v1/staff/institutions/"+institutionID+"/claims/"+claim.Data.ID+"/review", accounts[0].token, map[string]string{"status": "approved", "staff_note": "Synthetic verification completed."})
	if status != http.StatusOK {
		t.Fatalf("approve synthetic claim: status %d response %s", status, body)
	}
	status, body = integrationRequest(t, client, http.MethodPost, handoverURL, accounts[0].token, handoverPayload)
	if status != http.StatusCreated {
		t.Fatalf("handover after approval should succeed: status %d response %s", status, body)
	}
	status, _ = integrationRequest(t, client, http.MethodPost, handoverURL, accounts[0].token, handoverPayload)
	if status != http.StatusConflict {
		t.Fatalf("duplicate handover should be blocked: status %d", status)
	}

	t.Logf("passed 50 independent accounts: registration, login, session revocation, private report/claim isolation, tenant access, and verified one-time handover")
}

func integrationRequest(t *testing.T, client *http.Client, method, target, token string, input any) (int, []byte) {
	t.Helper()
	var body io.Reader
	if input != nil {
		encoded, err := json.Marshal(input)
		if err != nil {
			t.Fatal(err)
		}
		body = bytes.NewReader(encoded)
	}
	request, err := http.NewRequest(method, target, body)
	if err != nil {
		t.Fatal(err)
	}
	if input != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	return response.StatusCode, responseBody
}
