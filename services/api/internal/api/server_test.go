package api

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/auth"
)

func TestPublicItemRedaction(t *testing.T) {
	s := New(nil, auth.Validator{}, true, "")
	w := httptest.NewRecorder()
	s.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/items", nil))
	if w.Code != 200 {
		t.Fatalf("status %d", w.Code)
	}
	body := w.Body.String()
	for _, secret := range []string{"DO NOT PUBLISH", "contact_details", "evidence_reference", "private_title"} {
		if strings.Contains(body, secret) {
			t.Fatalf("public response leaked %q: %s", secret, body)
		}
	}
	if !strings.Contains(body, "Black water bottle") {
		t.Fatalf("expected fixture: %s", body)
	}
}
func TestPrivateAuthFailClosed(t *testing.T) {
	s := New(nil, auth.Validator{}, true, "")
	for _, tc := range []struct {
		path string
		want int
	}{{"/api/v1/reports", 503}, {"/api/v1/me/reports", 503}} {
		w := httptest.NewRecorder()
		req := httptest.NewRequest(map[bool]string{true: "POST", false: "GET"}[tc.path == "/api/v1/reports"], tc.path, strings.NewReader(`{"institution_id":"example-university","kind":"found","title":"x"}`))
		s.ServeHTTP(w, req)
		if w.Code != tc.want {
			t.Errorf("%s got %d want %d", tc.path, w.Code, tc.want)
		}
	}
}
func TestHealthRoutes(t *testing.T) {
	s := New(nil, auth.Validator{}, true, "")
	for _, path := range []string{"/healthz", "/readyz"} {
		w := httptest.NewRecorder()
		s.ServeHTTP(w, httptest.NewRequest("GET", path, nil))
		if w.Code != 200 {
			t.Errorf("%s: %d", path, w.Code)
		}
	}
}
func TestUnreviewedFixtureHidden(t *testing.T) {
	s := New(nil, auth.Validator{}, true, "")
	w := httptest.NewRecorder()
	s.ServeHTTP(w, httptest.NewRequest("GET", "/api/v1/items/private-draft", nil))
	if w.Code != 404 {
		t.Fatalf("got %d", w.Code)
	}
}

func TestStaffMatchingRequiresConfiguredAuth(t *testing.T) {
	s := New(nil, auth.Validator{}, true, "")
	w := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/staff/institutions/example-university/matches/suggest", strings.NewReader(`{"item_id":"sample-item-001"}`))
	s.ServeHTTP(w, req)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("got %d want %d: %s", w.Code, http.StatusServiceUnavailable, w.Body.String())
	}
	if strings.Contains(w.Body.String(), "suggestions") {
		t.Fatalf("unauthenticated request returned matching data: %s", w.Body.String())
	}
}
