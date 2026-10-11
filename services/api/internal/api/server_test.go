package api

import (
	"io"
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

func TestPublicSearchRanksOnlyApprovedSyntheticListings(t *testing.T) {
	ai := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatal(err)
		}
		if strings.Contains(string(body), "DO NOT PUBLISH") || strings.Contains(string(body), "private-draft") {
			t.Errorf("private fixture was sent to AI: %s", body)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"suggestions":[{"candidate_id":"sample-item-002","rank":1,"signal":{"name":"embeddinggemma2_semantic_with_metadata","version":"v1","score":0.8,"interpretation":"uncalibrated_assistive_suggestion_only"},"explanations":["Semantic text similarity surfaced this candidate."]}],"ranking":"embeddinggemma2_semantic_with_metadata_v1","notice":"Suggestions are assistive only."}`))
	}))
	defer ai.Close()

	s := New(nil, auth.Validator{}, true, ai.URL)
	s.AIMatchingEnabled = true
	w := httptest.NewRecorder()
	s.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/items/search?q=foldable%20blue%20thing", nil))
	if w.Code != http.StatusOK {
		t.Fatalf("got %d: %s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), `"source":"embeddinggemma"`) || !strings.Contains(w.Body.String(), `"Blue umbrella"`) {
		t.Fatalf("expected an embedding-ranked public result: %s", w.Body.String())
	}
	if strings.Contains(w.Body.String(), "private-draft") || strings.Contains(w.Body.String(), "DO NOT PUBLISH") {
		t.Fatalf("private fixture leaked from search: %s", w.Body.String())
	}
}

func TestPublicSearchRejectsContactDetails(t *testing.T) {
	s := New(nil, auth.Validator{}, true, "")
	w := httptest.NewRecorder()
	s.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/api/v1/items/search?q=person%40example.test", nil))
	if w.Code != http.StatusBadRequest || strings.Contains(w.Body.String(), "person@example.test") {
		t.Fatalf("expected safe contact rejection, got %d: %s", w.Code, w.Body.String())
	}
}

func TestPublicSummaryRejectsContactDetails(t *testing.T) {
	for _, value := range []string{"Call 555-123-4567", "person@example.test"} {
		if !hasContactDetails(value) {
			t.Errorf("expected contact-like text to be rejected: %q", value)
		}
	}
}
