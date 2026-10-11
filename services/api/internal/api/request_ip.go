package api

import (
	"fmt"
	"net"
	"net/http"
	"strings"
)

// SetTrustedProxyCIDRs accepts only explicit CIDR ranges. An invalid entry is a
// startup error so rate limits never silently trust an unintended proxy.
func (s *Server) SetTrustedProxyCIDRs(values []string) error {
	trusted := make([]*net.IPNet, 0, len(values))
	for _, value := range values {
		_, network, err := net.ParseCIDR(strings.TrimSpace(value))
		if err != nil {
			return fmt.Errorf("TRUSTED_PROXY_CIDRS contains an invalid CIDR")
		}
		trusted = append(trusted, network)
	}
	s.trustedProxies = trusted
	return nil
}

// requestAddress uses the direct socket peer by default. It reads exactly one
// X-Forwarded-For address only when that peer belongs to a configured trusted
// proxy range; callers must configure the proxy to overwrite that header.
func (s *Server) requestAddress(r *http.Request) string {
	peer := remoteIP(r.RemoteAddr)
	if peer == nil {
		return "unknown"
	}
	for _, network := range s.trustedProxies {
		if network.Contains(peer) {
			forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For"))
			if client := net.ParseIP(forwarded); client != nil {
				return client.String()
			}
			break
		}
	}
	return peer.String()
}

func remoteIP(remoteAddr string) net.IP {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil {
		host = remoteAddr
	}
	return net.ParseIP(strings.TrimSpace(host))
}
