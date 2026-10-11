package api

import (
	"net/http/httptest"
	"testing"

	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/auth"
)

func TestRequestAddressDoesNotTrustArbitraryForwardedHeaders(t *testing.T) {
	server := New(nil, auth.Validator{}, "")
	request := httptest.NewRequest("GET", "http://api.test/healthz", nil)
	request.RemoteAddr = "203.0.113.7:443"
	request.Header.Set("X-Forwarded-For", "198.51.100.9")
	if got := server.requestAddress(request); got != "203.0.113.7" {
		t.Fatalf("untrusted forwarded address was accepted: %q", got)
	}
}

func TestRequestAddressUsesSingleAddressFromConfiguredTrustedProxy(t *testing.T) {
	server := New(nil, auth.Validator{}, "")
	if err := server.SetTrustedProxyCIDRs([]string{"10.20.0.0/16"}); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest("GET", "http://api.test/healthz", nil)
	request.RemoteAddr = "10.20.0.5:8080"
	request.Header.Set("X-Forwarded-For", "198.51.100.9")
	if got := server.requestAddress(request); got != "198.51.100.9" {
		t.Fatalf("trusted proxy address = %q", got)
	}
	request.Header.Set("X-Forwarded-For", "198.51.100.9, 192.0.2.1")
	if got := server.requestAddress(request); got != "10.20.0.5" {
		t.Fatalf("multi-value forwarded address was accepted: %q", got)
	}
}

func TestTrustedProxyCIDRsRejectInvalidRanges(t *testing.T) {
	server := New(nil, auth.Validator{}, "")
	if err := server.SetTrustedProxyCIDRs([]string{"not-a-cidr"}); err == nil {
		t.Fatal("expected invalid proxy CIDR to fail startup validation")
	}
}
