package auth

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
)

var ErrNotConfigured = errors.New("authentication is not configured")
var ErrUnauthenticated = errors.New("authentication required or invalid")

type Validator struct {
	URL, AnonKey string
	Client       *http.Client
}
type User struct {
	ID string `json:"id"`
}

func (v Validator) Validate(ctx context.Context, header string) (User, error) {
	if v.URL == "" || v.AnonKey == "" {
		return User{}, ErrNotConfigured
	}
	parts := strings.Fields(header)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || parts[1] == "" {
		return User{}, ErrUnauthenticated
	}
	client := v.Client
	if client == nil {
		client = &http.Client{Timeout: 4 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, v.URL+"/auth/v1/user", nil)
	if err != nil {
		return User{}, ErrUnauthenticated
	}
	req.Header.Set("Authorization", "Bearer "+parts[1])
	req.Header.Set("apikey", v.AnonKey)
	res, err := client.Do(req)
	if err != nil {
		return User{}, fmt.Errorf("auth service unavailable: %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode == http.StatusUnauthorized || res.StatusCode == http.StatusForbidden {
		return User{}, ErrUnauthenticated
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return User{}, fmt.Errorf("auth service unavailable (status %d)", res.StatusCode)
	}
	var u User
	if err := json.NewDecoder(res.Body).Decode(&u); err != nil || strings.TrimSpace(u.ID) == "" {
		return User{}, ErrUnauthenticated
	}
	return u, nil
}
