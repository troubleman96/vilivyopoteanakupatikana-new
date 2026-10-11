package api

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync/atomic"
	"time"
)

type requestIDContextKey struct{}

type apiMetrics struct {
	requests       atomic.Uint64
	responses2xx   atomic.Uint64
	responses3xx   atomic.Uint64
	responses4xx   atomic.Uint64
	responses5xx   atomic.Uint64
	responsesOther atomic.Uint64
	durationNanos  atomic.Uint64
	rateLimited    atomic.Uint64
}

func (m *apiMetrics) observe(status int, elapsed time.Duration) {
	m.requests.Add(1)
	m.durationNanos.Add(uint64(elapsed))
	switch status / 100 {
	case 2:
		m.responses2xx.Add(1)
	case 3:
		m.responses3xx.Add(1)
	case 4:
		m.responses4xx.Add(1)
	case 5:
		m.responses5xx.Add(1)
	default:
		m.responsesOther.Add(1)
	}
}

func (m *apiMetrics) serve(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = fmt.Fprintf(w, "# HELP api_http_requests_total Total HTTP requests handled by this API process.\n# TYPE api_http_requests_total counter\napi_http_requests_total %d\n", m.requests.Load())
	_, _ = fmt.Fprintf(w, "# HELP api_http_responses_total Responses grouped by status class.\n# TYPE api_http_responses_total counter\napi_http_responses_total{status_class=\"2xx\"} %d\napi_http_responses_total{status_class=\"3xx\"} %d\napi_http_responses_total{status_class=\"4xx\"} %d\napi_http_responses_total{status_class=\"5xx\"} %d\napi_http_responses_total{status_class=\"other\"} %d\n", m.responses2xx.Load(), m.responses3xx.Load(), m.responses4xx.Load(), m.responses5xx.Load(), m.responsesOther.Load())
	_, _ = fmt.Fprintf(w, "# HELP api_http_request_duration_seconds_sum Sum of observed HTTP request durations.\n# TYPE api_http_request_duration_seconds_sum counter\napi_http_request_duration_seconds_sum %.6f\n", float64(m.durationNanos.Load())/float64(time.Second))
	_, _ = fmt.Fprintf(w, "# HELP api_http_request_duration_seconds_count Number of observed HTTP request durations.\n# TYPE api_http_request_duration_seconds_count counter\napi_http_request_duration_seconds_count %d\n", m.requests.Load())
	_, _ = fmt.Fprintf(w, "# HELP api_rate_limit_rejections_total Requests rejected by API rate limits.\n# TYPE api_rate_limit_rejections_total counter\napi_rate_limit_rejections_total %d\n", m.rateLimited.Load())
}

type statusResponseWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusResponseWriter) WriteHeader(status int) {
	if w.status != 0 {
		return
	}
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}

func (w *statusResponseWriter) Write(p []byte) (int, error) {
	if w.status == 0 {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(p)
}

func (w *statusResponseWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func newRequestID() string {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "unavailable"
	}
	return hex.EncodeToString(raw[:])
}

func routeFamily(path string) string {
	switch {
	case path == "/healthz":
		return "health"
	case path == "/readyz":
		return "readiness"
	case path == "/metrics":
		return "metrics"
	case strings.HasPrefix(path, "/api/v1/auth/"):
		return "auth"
	case strings.Contains(path, "/matches/suggest"):
		return "staff_matching"
	case strings.HasPrefix(path, "/api/v1/staff/"):
		return "staff"
	case path == "/api/v1/items/search":
		return "public_search"
	case strings.HasPrefix(path, "/api/v1/items"):
		return "public_items"
	case path == "/api/v1/reports":
		return "report_submission"
	case strings.HasPrefix(path, "/api/v1/me/"):
		return "account_data"
	case strings.HasPrefix(path, "/api/v1/"):
		return "api"
	default:
		return "other"
	}
}

func (s *Server) observeHTTP(w http.ResponseWriter, r *http.Request, next func(http.ResponseWriter, *http.Request)) {
	requestID := newRequestID()
	r = r.WithContext(context.WithValue(r.Context(), requestIDContextKey{}, requestID))
	w.Header().Set("X-Request-ID", requestID)
	tracked := &statusResponseWriter{ResponseWriter: w}
	started := time.Now()
	next(tracked, r)
	status := tracked.status
	if status == 0 {
		status = http.StatusOK
	}
	elapsed := time.Since(started)
	s.metrics.observe(status, elapsed)
	if route := routeFamily(r.URL.Path); route != "health" && route != "readiness" && route != "metrics" {
		slog.Info("http_request", "request_id", requestID, "method", r.Method, "route", route, "status", status, "duration_ms", elapsed.Milliseconds())
	}
}
