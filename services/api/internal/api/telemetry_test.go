package api

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/auth"
)

func TestTelemetryIsAggregatedAndDoesNotLogQueryData(t *testing.T) {
	oldLogger := slog.Default()
	var logOutput bytes.Buffer
	slog.SetDefault(slog.New(slog.NewJSONHandler(&logOutput, nil)))
	defer slog.SetDefault(oldLogger)

	server := New(nil, auth.Validator{}, "")
	request := httptest.NewRequest(http.MethodGet, "/api/v1/items/search?q=synthetic-private%40example.invalid", nil)
	recorder := httptest.NewRecorder()
	server.ServeHTTP(recorder, request)
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("got %d want %d", recorder.Code, http.StatusBadRequest)
	}
	if got := recorder.Header().Get("X-Request-ID"); len(got) != 32 {
		t.Fatalf("unexpected request ID %q", got)
	}
	if strings.Contains(logOutput.String(), "synthetic-private") || strings.Contains(logOutput.String(), "example.invalid") {
		t.Fatalf("request log contains query data: %s", logOutput.String())
	}

	metrics := httptest.NewRecorder()
	server.ServeHTTP(metrics, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if metrics.Code != http.StatusOK || !strings.Contains(metrics.Body.String(), "api_http_requests_total 1") || !strings.Contains(metrics.Body.String(), `status_class="4xx"} 1`) {
		t.Fatalf("unexpected aggregate metrics response: %d %s", metrics.Code, metrics.Body.String())
	}
	if strings.Contains(metrics.Body.String(), "synthetic-private") || strings.Contains(metrics.Body.String(), "example.invalid") {
		t.Fatalf("metrics exposed request data: %s", metrics.Body.String())
	}
}
