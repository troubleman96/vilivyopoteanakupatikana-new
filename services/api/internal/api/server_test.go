package api

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/auth"
	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/store"
)

func TestPublicRoutesFailClosedWithoutDatabase(t *testing.T) {
	server := New(nil, auth.Validator{}, "")
	for _, path := range []string{
		"/api/v1/institutions",
		"/api/v1/institutions/example-university",
		"/api/v1/items",
		"/api/v1/items/private-draft",
		"/api/v1/items/search?q=blue",
	} {
		recorder := httptest.NewRecorder()
		server.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		if recorder.Code != http.StatusServiceUnavailable {
			t.Errorf("%s got %d want %d: %s", path, recorder.Code, http.StatusServiceUnavailable, recorder.Body.String())
		}
		for _, synthetic := range []string{"Black water bottle", "Blue umbrella", "Example University", "DO NOT PUBLISH"} {
			if strings.Contains(recorder.Body.String(), synthetic) {
				t.Errorf("%s returned synthetic sample data %q: %s", path, synthetic, recorder.Body.String())
			}
		}
	}
}

func TestConfiguredButClosedDatabaseFailsClosed(t *testing.T) {
	pool, err := pgxpool.New(context.Background(), "postgres://unused:unused@127.0.0.1:1/unavailable_test?connect_timeout=1")
	if err != nil {
		t.Fatal(err)
	}
	pool.Close()
	server := New(&store.Store{Pool: pool}, auth.Validator{Pool: pool}, "")
	for _, path := range []string{"/readyz", "/api/v1/institutions", "/api/v1/items", "/api/v1/items/search?q=synthetic"} {
		recorder := httptest.NewRecorder()
		server.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, path, nil))
		if recorder.Code != http.StatusServiceUnavailable {
			t.Errorf("%s got %d want %d: %s", path, recorder.Code, http.StatusServiceUnavailable, recorder.Body.String())
		}
		if strings.Contains(recorder.Body.String(), "Black water bottle") || strings.Contains(recorder.Body.String(), "Blue umbrella") {
			t.Errorf("%s returned synthetic sample records while PostgreSQL was unavailable", path)
		}
	}
}

func TestPrivateAuthFailClosed(t *testing.T) {
	server := New(nil, auth.Validator{}, "")
	for _, test := range []struct {
		path   string
		method string
	}{{"/api/v1/reports", http.MethodPost}, {"/api/v1/me/reports", http.MethodGet}, {"/api/v1/staff/institutions/synthetic/claims/synthetic/verification", http.MethodPost}} {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(test.method, test.path, strings.NewReader(`{"institution_id":"synthetic-only","kind":"found","title":"x"}`))
		server.ServeHTTP(recorder, request)
		if recorder.Code != http.StatusServiceUnavailable {
			t.Errorf("%s got %d want %d", test.path, recorder.Code, http.StatusServiceUnavailable)
		}
	}
}

func TestHealthRoutesSeparateLivenessAndReadiness(t *testing.T) {
	server := New(nil, auth.Validator{}, "")
	for _, test := range []struct {
		path string
		want int
	}{{"/healthz", http.StatusOK}, {"/readyz", http.StatusServiceUnavailable}} {
		recorder := httptest.NewRecorder()
		server.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, test.path, nil))
		if recorder.Code != test.want {
			t.Errorf("%s got %d want %d", test.path, recorder.Code, test.want)
		}
	}
}

func TestStaffMatchingRequiresConfiguredAuth(t *testing.T) {
	server := New(nil, auth.Validator{}, "")
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/api/v1/staff/institutions/synthetic-only/matches/suggest", strings.NewReader(`{"item_id":"synthetic-item"}`))
	server.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("got %d want %d: %s", recorder.Code, http.StatusServiceUnavailable, recorder.Body.String())
	}
	if strings.Contains(recorder.Body.String(), "suggestions") {
		t.Fatalf("unauthenticated request returned matching data: %s", recorder.Body.String())
	}
}

func TestPublicSearchDoesNotCallAIAfterDatabaseFailure(t *testing.T) {
	var calls atomic.Int32
	ai := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		_, _ = io.Copy(io.Discard, r.Body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"suggestions":[],"ranking":"test","notice":"test"}`))
	}))
	defer ai.Close()

	server := New(nil, auth.Validator{}, ai.URL)
	server.AIMatchingEnabled = true
	recorder := httptest.NewRecorder()
	server.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/items/search?q=synthetic", nil))
	if recorder.Code != http.StatusServiceUnavailable {
		t.Fatalf("got %d want %d: %s", recorder.Code, http.StatusServiceUnavailable, recorder.Body.String())
	}
	if calls.Load() != 0 {
		t.Fatalf("AI service was called %d times without database-backed candidates", calls.Load())
	}
}

func TestPublicSearchRejectsContactDetails(t *testing.T) {
	server := New(nil, auth.Validator{}, "")
	recorder := httptest.NewRecorder()
	server.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/api/v1/items/search?q=person%40example.test", nil))
	if recorder.Code != http.StatusBadRequest || strings.Contains(recorder.Body.String(), "person@example.test") {
		t.Fatalf("expected safe contact rejection, got %d: %s", recorder.Code, recorder.Body.String())
	}
}

func TestPublicSummaryRejectsContactDetails(t *testing.T) {
	for _, value := range []string{"Call 555-123-4567", "person@example.test"} {
		if !hasContactDetails(value) {
			t.Errorf("expected contact-like text to be rejected: %q", value)
		}
	}
}
