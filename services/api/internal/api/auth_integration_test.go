package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
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

type integrationSession struct {
	ExpiresAt time.Time `json:"expires_at"`
	User      auth.User `json:"user"`
}

type integrationIdentity struct {
	ID    string `json:"id"`
	Email string `json:"email"`
}

type integrationRow struct {
	ID string `json:"id"`
}

type integrationAccount struct {
	user     auth.User
	cookie   string
	client   *http.Client
	reportID string
	claimID  string
	email    string
	password string
}

func TestFiftyLocalPostgresAccountsAndIdentityHardening(t *testing.T) {
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("set TEST_DATABASE_URL to an isolated local database ending in _test to run the synthetic integration suite")
	}
	parsed, err := url.Parse(databaseURL)
	if err != nil || (parsed.Hostname() != "localhost" && parsed.Hostname() != "127.0.0.1") || !strings.Contains(parsed.Path, "_test") {
		t.Fatal("TEST_DATABASE_URL must target localhost and a database name containing _test; use a dedicated disposable test database")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Minute)
	defer cancel()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	if err := pool.Ping(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `DELETE FROM auth_rate_limits`); err != nil {
		t.Fatalf("reset rate-limit state in the dedicated test database: %v", err)
	}
	var institutionID, publicItemID string
	if err := pool.QueryRow(ctx, `SELECT id::text FROM institutions WHERE active=true ORDER BY created_at LIMIT 1`).Scan(&institutionID); err != nil {
		t.Fatalf("apply database migrations and seed an active synthetic institution first: %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT id::text FROM items WHERE review_status='approved' AND visibility='public' ORDER BY created_at LIMIT 1`).Scan(&publicItemID); err != nil {
		t.Fatalf("apply demo seed migration for the claim isolation test: %v", err)
	}
	var otherInstitutionID string
	tag := fmt.Sprintf("auth1-%d", time.Now().UnixNano())
	if err := pool.QueryRow(ctx, `INSERT INTO institutions(name,region) VALUES($1,'Synthetic test only') RETURNING id::text`, tag+"-other").Scan(&otherInstitutionID); err != nil {
		t.Fatal(err)
	}

	apiServer := New(&store.Store{Pool: pool}, auth.Validator{Pool: pool, PublicAppURL: "http://localhost:3000", CookieSecure: true}, false, "")
	apiServer.CORSAllowedOrigins = []string{"http://localhost:3000"}
	server := httptest.NewServer(integrationRemoteIPShim(apiServer))
	defer server.Close()

	accounts := make([]integrationAccount, 50)
	userIDs := make([]string, 0, 50)
	defer func() {
		cleanupCtx, cleanupCancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cleanupCancel()
		if _, err := pool.Exec(cleanupCtx, `DELETE FROM auth_rate_limits`); err != nil {
			t.Errorf("clean rate-limit state from the dedicated test database: %v", err)
		}
		_, _ = pool.Exec(cleanupCtx, `DELETE FROM auth_email_outbox WHERE recipient LIKE $1`, tag+"-%@example.test")
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
		accountClient := integrationClient(server, fmt.Sprintf("192.0.2.%d", index+10))
		accounts[i] = integrationAccount{email: email, password: password, client: accountClient}
		status, body := integrationRequest(t, accountClient, http.MethodPost, server.URL+"/api/v1/auth/register", "", map[string]string{"email": registrationEmail, "password": password})
		if status != http.StatusAccepted {
			t.Fatalf("account %d registration: status %d response %s", index, status, body)
		}
		var responseFields map[string]json.RawMessage
		if err := json.Unmarshal(body, &responseFields); err != nil {
			t.Fatalf("account %d returned an invalid registration response: %s (%v)", index, body, err)
		}
		if _, hasToken := responseFields["access_token"]; hasToken {
			t.Fatalf("account %d registration exposed a bearer token", index)
		}
		initialVerificationToken := readOutboxToken(t, ctx, pool, email, "verify", "/auth/verify?token=")
		if i == 0 {
			status, body = integrationRequest(t, accountClient, http.MethodPost, server.URL+"/api/v1/auth/login", "", map[string]string{"email": email, "password": password})
			if status != http.StatusForbidden {
				t.Fatalf("unverified account should not start a session: status %d response %s", status, body)
			}
			status, body = integrationRequest(t, accountClient, http.MethodPost, server.URL+"/api/v1/auth/register", "", map[string]string{"email": email, "password": password})
			if status != http.StatusAccepted {
				t.Fatalf("duplicate registration should not disclose account existence: status %d response %s", status, body)
			}
			status, body = integrationRequest(t, accountClient, http.MethodPost, server.URL+"/api/v1/auth/register", "", map[string]string{"email": tag + "-weak@example.test", "password": "too-short"})
			if status != http.StatusBadRequest {
				t.Fatalf("weak password should be rejected: status %d response %s", status, body)
			}
			status, body = integrationRequest(t, accountClient, http.MethodPost, server.URL+"/api/v1/auth/verification/request", "", map[string]string{"email": email})
			if status != http.StatusAccepted {
				t.Fatalf("verification resend should be accepted: status %d response %s", status, body)
			}
			status, _ = integrationRequest(t, accountClient, http.MethodPost, server.URL+"/api/v1/auth/verify-email", "", map[string]string{"token": initialVerificationToken})
			if status != http.StatusBadRequest {
				t.Fatalf("superseded verification token should not work: status %d", status)
			}
		}
		verificationToken := readOutboxToken(t, ctx, pool, email, "verify", "/auth/verify?token=")
		status, body = integrationRequest(t, accountClient, http.MethodPost, server.URL+"/api/v1/auth/verify-email", "", map[string]string{"token": verificationToken})
		if status != http.StatusOK {
			t.Fatalf("account %d verification failed: status %d response %s", index, status, body)
		}
		status, _ = integrationRequest(t, accountClient, http.MethodPost, server.URL+"/api/v1/auth/verify-email", "", map[string]string{"token": verificationToken})
		if status != http.StatusBadRequest {
			t.Fatalf("account %d verification token was reusable: status %d", index, status)
		}

		status, body, cookie := integrationRequestAndCookie(t, accountClient, http.MethodPost, server.URL+"/api/v1/auth/login", "", map[string]string{"email": email, "password": password})
		if status != http.StatusOK || cookie == nil {
			t.Fatalf("account %d login failed: status %d response %s", index, status, body)
		}
		if cookie.Name != auth.SessionCookieName || !cookie.HttpOnly || !cookie.Secure || cookie.Path != "/" || cookie.Domain != "" || cookie.SameSite != http.SameSiteLaxMode {
			t.Fatalf("account %d received an insecure session cookie: %+v", index, cookie)
		}
		var login struct {
			Data integrationSession `json:"data"`
		}
		if err := json.Unmarshal(body, &login); err != nil || login.Data.User.ID == "" {
			t.Fatalf("account %d received invalid session metadata: %s (%v)", index, body, err)
		}
		if !login.Data.ExpiresAt.After(time.Now()) || login.Data.ExpiresAt.After(time.Now().Add(31*24*time.Hour)) || login.Data.User.Email != email {
			t.Fatalf("account %d received invalid identity or expiry: %+v", index, login.Data)
		}
		if strings.Contains(string(body), cookie.Value) || strings.Contains(string(body), `"access_token"`) {
			t.Fatalf("account %d received a session secret in the JSON response", index)
		}
		accounts[i].cookie = cookie.Value
		accounts[i].user = login.Data.User
		userIDs = append(userIDs, login.Data.User.ID)

		if i == 0 {
			status, body = integrationRequestOrigin(t, accountClient, http.MethodPost, server.URL+"/api/v1/auth/logout", "cookie:"+cookie.Value, map[string]string{}, "https://attacker.example")
			if status != http.StatusForbidden {
				t.Fatalf("cookie-authenticated cross-origin mutation was not blocked: status %d response %s", status, body)
			}
			status, _ = integrationRequest(t, accountClient, http.MethodPost, server.URL+"/api/v1/auth/login", "", map[string]string{"email": email, "password": "incorrect-password"})
			if status != http.StatusUnauthorized {
				t.Fatalf("incorrect password should be rejected: status %d", status)
			}
		}

		status, body = integrationRequest(t, accountClient, http.MethodPost, server.URL+"/api/v1/reports", "cookie:"+cookie.Value, map[string]string{
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

		status, body = integrationRequest(t, accountClient, http.MethodPost, server.URL+"/api/v1/me/claims", "cookie:"+cookie.Value, map[string]string{
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
		credential := "cookie:" + account.cookie
		status, body := integrationRequest(t, account.client, http.MethodGet, server.URL+"/api/v1/me/reports", credential, nil)
		if status != http.StatusOK {
			t.Fatalf("account %d own reports: status %d response %s", index, status, body)
		}
		var reports struct {
			Data []integrationRow `json:"data"`
		}
		if err := json.Unmarshal(body, &reports); err != nil || len(reports.Data) != 1 || reports.Data[0].ID != account.reportID {
			t.Fatalf("account %d saw non-owned reports or an invalid response: %s (%v)", index, body, err)
		}

		status, body = integrationRequest(t, account.client, http.MethodGet, server.URL+"/api/v1/me/claims", credential, nil)
		if status != http.StatusOK {
			t.Fatalf("account %d own claims: status %d response %s", index, status, body)
		}
		var claims struct {
			Data []integrationRow `json:"data"`
		}
		if err := json.Unmarshal(body, &claims); err != nil || len(claims.Data) != 1 || claims.Data[0].ID != account.claimID {
			t.Fatalf("account %d saw non-owned claims or an invalid response: %s (%v)", index, body, err)
		}

		status, body = integrationRequest(t, account.client, http.MethodGet, server.URL+"/api/v1/auth/me", credential, nil)
		var me struct {
			Data integrationIdentity `json:"data"`
		}
		if status != http.StatusOK || json.Unmarshal(body, &me) != nil || me.Data.ID != account.user.ID || me.Data.Email != account.email {
			t.Fatalf("account %d identity check failed: status %d response %s", index, status, body)
		}

		status, body, secondCookie := integrationRequestAndCookie(t, account.client, http.MethodPost, server.URL+"/api/v1/auth/login", "", map[string]string{"email": account.email, "password": account.password})
		var login struct {
			Data integrationSession `json:"data"`
		}
		if status != http.StatusOK || json.Unmarshal(body, &login) != nil || login.Data.User.ID != account.user.ID || secondCookie == nil {
			t.Fatalf("account %d second login failed: status %d response %s", index, status, body)
		}
		if secondCookie.Value == account.cookie {
			t.Fatalf("account %d login reused its previous session token", index)
		}
		status, body = integrationRequest(t, account.client, http.MethodPost, server.URL+"/api/v1/auth/logout", "cookie:"+secondCookie.Value, map[string]string{})
		if status != http.StatusOK {
			t.Fatalf("account %d logout check failed: status %d response %s", index, status, body)
		}
		status, _ = integrationRequest(t, account.client, http.MethodGet, server.URL+"/api/v1/auth/me", "cookie:"+secondCookie.Value, nil)
		if status != http.StatusUnauthorized {
			t.Fatalf("account %d revoked session remained valid: status %d", index, status)
		}
	}

	limitedRegisterClient := integrationClient(server, "192.0.2.249")
	for attempt := 1; attempt <= 6; attempt++ {
		status, _ := integrationRequest(t, limitedRegisterClient, http.MethodPost, server.URL+"/api/v1/auth/register", "", map[string]string{
			"email":    fmt.Sprintf("register-limit-%d@example.test", attempt),
			"password": "too-short",
		})
		if attempt <= 5 && status != http.StatusBadRequest {
			t.Fatalf("invalid registration attempt %d should reach validation before the threshold, got %d", attempt, status)
		}
		if attempt == 6 && status != http.StatusTooManyRequests {
			t.Fatalf("sixth registration attempt from one address should be throttled, got %d", status)
		}
	}

	limitedClient := integrationClient(server, "192.0.2.250")
	for attempt := 1; attempt <= 7; attempt++ {
		status, _ := integrationRequest(t, limitedClient, http.MethodPost, server.URL+"/api/v1/auth/login", "", map[string]string{"email": "limit@example.test", "password": "incorrect-password"})
		if attempt <= 6 && status != http.StatusUnauthorized {
			t.Fatalf("failed login attempt %d should be allowed before the threshold, got %d", attempt, status)
		}
		if attempt == 7 && status != http.StatusTooManyRequests {
			t.Fatalf("seventh failed login should be throttled, got %d", status)
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
		status, body := integrationRequest(t, accounts[test.user].client, http.MethodGet, server.URL+"/api/v1/staff/institutions/"+test.orgID+"/cases", "cookie:"+accounts[test.user].cookie, nil)
		if status != test.want {
			t.Errorf("tenant boundary %q: status %d want %d response %s", test.name, status, test.want, body)
		}
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
	status, body := integrationRequest(t, accounts[1].client, http.MethodPost, server.URL+"/api/v1/me/claims", "cookie:"+accounts[1].cookie, map[string]string{"item_id": handoverItemID, "statement": "Synthetic proof for controlled handover."})
	var claim struct {
		Data integrationRow `json:"data"`
	}
	if status != http.StatusCreated || json.Unmarshal(body, &claim) != nil {
		t.Fatalf("create gated handover claim: status %d response %s", status, body)
	}
	caseURL := server.URL + "/api/v1/staff/institutions/" + institutionID + "/cases/" + handoverCaseID
	status, body = integrationRequest(t, accounts[0].client, http.MethodPatch, caseURL, "cookie:"+accounts[0].cookie, map[string]string{"status": "returned"})
	if status != http.StatusBadRequest {
		t.Fatalf("direct return transition should require verified handover: status %d response %s", status, body)
	}
	status, body = integrationRequest(t, accounts[0].client, http.MethodPatch, caseURL, "cookie:"+accounts[0].cookie, map[string]string{"status": "matched"})
	if status != http.StatusOK {
		t.Fatalf("prepare matched case: status %d response %s", status, body)
	}
	handoverURL := caseURL + "/handover"
	handoverPayload := map[string]string{"claim_id": claim.Data.ID, "handover_at": time.Now().UTC().Format(time.RFC3339), "details": "Synthetic verified handover.", "recipient": "Synthetic account 02"}
	status, body = integrationRequest(t, accounts[0].client, http.MethodPost, handoverURL, "cookie:"+accounts[0].cookie, handoverPayload)
	if status != http.StatusConflict {
		t.Fatalf("handover without an approved claim should be blocked: status %d response %s", status, body)
	}
	status, body = integrationRequest(t, accounts[0].client, http.MethodPost, server.URL+"/api/v1/staff/institutions/"+institutionID+"/claims/"+claim.Data.ID+"/review", "cookie:"+accounts[0].cookie, map[string]string{"status": "approved", "staff_note": "Synthetic verification completed."})
	if status != http.StatusOK {
		t.Fatalf("approve synthetic claim: status %d response %s", status, body)
	}
	status, body = integrationRequest(t, accounts[0].client, http.MethodPost, handoverURL, "cookie:"+accounts[0].cookie, handoverPayload)
	if status != http.StatusCreated {
		t.Fatalf("handover after approval should succeed: status %d response %s", status, body)
	}
	status, _ = integrationRequest(t, accounts[0].client, http.MethodPost, handoverURL, "cookie:"+accounts[0].cookie, handoverPayload)
	if status != http.StatusConflict {
		t.Fatalf("duplicate handover should be blocked: status %d", status)
	}

	knownStatus, knownBody := integrationRequest(t, accounts[0].client, http.MethodPost, server.URL+"/api/v1/auth/password-reset/request", "", map[string]string{"email": accounts[0].email})
	unknownStatus, unknownBody := integrationRequest(t, accounts[0].client, http.MethodPost, server.URL+"/api/v1/auth/password-reset/request", "", map[string]string{"email": "not-registered@example.test"})
	if knownStatus != http.StatusAccepted || unknownStatus != http.StatusAccepted || string(knownBody) != string(unknownBody) {
		t.Fatalf("password reset request should have a generic response: known %d %s unknown %d %s", knownStatus, knownBody, unknownStatus, unknownBody)
	}
	resetToken := readOutboxToken(t, ctx, pool, accounts[0].email, "reset", "/auth/reset-password?token=")
	status, body = integrationRequest(t, accounts[0].client, http.MethodPost, server.URL+"/api/v1/auth/password-reset/confirm", "", map[string]string{"token": resetToken, "password": "Synthetic-New-Password-02!"})
	if status != http.StatusOK {
		t.Fatalf("password reset failed: status %d response %s", status, body)
	}
	status, _ = integrationRequest(t, accounts[0].client, http.MethodGet, server.URL+"/api/v1/auth/me", "cookie:"+accounts[0].cookie, nil)
	if status != http.StatusUnauthorized {
		t.Fatalf("password reset did not revoke the previous session: status %d", status)
	}
	status, _ = integrationRequest(t, accounts[0].client, http.MethodPost, server.URL+"/api/v1/auth/password-reset/confirm", "", map[string]string{"token": resetToken, "password": "Synthetic-New-Password-02!"})
	if status != http.StatusBadRequest {
		t.Fatalf("password reset token was reusable: status %d", status)
	}
	status, _ = integrationRequest(t, accounts[0].client, http.MethodPost, server.URL+"/api/v1/auth/login", "", map[string]string{"email": accounts[0].email, "password": accounts[0].password})
	if status != http.StatusUnauthorized {
		t.Fatalf("old password still worked after reset: status %d", status)
	}
	status, body, resetCookie := integrationRequestAndCookie(t, accounts[0].client, http.MethodPost, server.URL+"/api/v1/auth/login", "", map[string]string{"email": accounts[0].email, "password": "Synthetic-New-Password-02!"})
	if status != http.StatusOK || resetCookie == nil {
		t.Fatalf("new password did not work after reset: status %d response %s", status, body)
	}

	// Revoke every session for account 2, including its still-active original cookie.
	account := accounts[1]
	status, body, freshCookie := integrationRequestAndCookie(t, account.client, http.MethodPost, server.URL+"/api/v1/auth/login", "", map[string]string{"email": account.email, "password": account.password})
	if status != http.StatusOK || freshCookie == nil {
		t.Fatalf("could not create second concurrent session: status %d response %s", status, body)
	}
	status, body = integrationRequest(t, account.client, http.MethodPost, server.URL+"/api/v1/auth/logout-all", "cookie:"+freshCookie.Value, map[string]string{})
	if status != http.StatusOK {
		t.Fatalf("logout-all failed: status %d response %s", status, body)
	}
	status, _ = integrationRequest(t, account.client, http.MethodGet, server.URL+"/api/v1/auth/me", "cookie:"+account.cookie, nil)
	if status != http.StatusUnauthorized {
		t.Fatalf("logout-all left another account session valid: status %d", status)
	}

	t.Logf("passed 50 synthetic PostgreSQL accounts: email verification/resend, secure cookies, login throttling, password reset and session revocation, private record isolation, institution authorization, and controlled handover")
}

func readOutboxToken(t *testing.T, ctx context.Context, pool *pgxpool.Pool, recipient, purpose, marker string) string {
	t.Helper()
	var body string
	if err := pool.QueryRow(ctx, `SELECT body_text FROM auth_email_outbox WHERE recipient=$1 AND purpose=$2 ORDER BY id DESC LIMIT 1`, recipient, purpose).Scan(&body); err != nil {
		t.Fatalf("read synthetic %s mail from local outbox: %v", purpose, err)
	}
	index := strings.LastIndex(body, marker)
	if index < 0 {
		t.Fatalf("local outbox %s message did not contain its expected link", purpose)
	}
	return strings.Fields(body[index+len(marker):])[0]
}

type integrationIPTransport struct {
	base http.RoundTripper
	ip   string
}

func (t integrationIPTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	copy := request.Clone(request.Context())
	copy.Header = request.Header.Clone()
	copy.Header.Set("X-Test-Client-IP", t.ip)
	return t.base.RoundTrip(copy)
}

func integrationClient(server *httptest.Server, ip string) *http.Client {
	return &http.Client{Transport: integrationIPTransport{base: server.Client().Transport, ip: ip}}
}

func integrationRemoteIPShim(handler http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ip := r.Header.Get("X-Test-Client-IP"); net.ParseIP(ip) != nil {
			r.RemoteAddr = net.JoinHostPort(ip, "12345")
			r.Header.Del("X-Test-Client-IP")
		}
		handler.ServeHTTP(w, r)
	})
}

func integrationRequest(t *testing.T, client *http.Client, method, target, credential string, input any) (int, []byte) {
	status, body := integrationRequestOrigin(t, client, method, target, credential, input, "http://localhost:3000")
	return status, body
}

func integrationRequestAndCookie(t *testing.T, client *http.Client, method, target, credential string, input any) (int, []byte, *http.Cookie) {
	return integrationExchange(t, client, method, target, credential, input, "http://localhost:3000")
}

func integrationRequestOrigin(t *testing.T, client *http.Client, method, target, credential string, input any, origin string) (int, []byte) {
	status, body, _ := integrationExchange(t, client, method, target, credential, input, origin)
	return status, body
}

func integrationExchange(t *testing.T, client *http.Client, method, target, credential string, input any, origin string) (int, []byte, *http.Cookie) {
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
	if origin != "" {
		request.Header.Set("Origin", origin)
	}
	if strings.HasPrefix(credential, "cookie:") {
		request.AddCookie(&http.Cookie{Name: auth.SessionCookieName, Value: strings.TrimPrefix(credential, "cookie:")})
	} else if credential != "" {
		request.Header.Set("Authorization", "Bearer "+credential)
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
	var sessionCookie *http.Cookie
	for _, candidate := range response.Cookies() {
		if candidate.Name == auth.SessionCookieName {
			sessionCookie = candidate
			break
		}
	}
	return response.StatusCode, responseBody, sessionCookie
}
