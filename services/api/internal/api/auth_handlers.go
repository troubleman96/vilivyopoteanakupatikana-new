package api

import (
	"errors"
	"net/http"

	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/auth"
)

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func setAuthNoStore(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-store, private")
}

func authUnavailable(w http.ResponseWriter) {
	fail(w, http.StatusServiceUnavailable, "auth_unavailable", "local authentication requires a configured PostgreSQL database")
}

func (s *Server) registerAccount(w http.ResponseWriter, r *http.Request) {
	setAuthNoStore(w)
	var input credentials
	if body(r, &input) != nil {
		fail(w, http.StatusBadRequest, "invalid_request", "email and password are required")
		return
	}
	session, err := s.Auth.Register(r.Context(), input.Email, input.Password)
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrNotConfigured):
			authUnavailable(w)
		case errors.Is(err, auth.ErrEmailTaken):
			fail(w, http.StatusConflict, "email_taken", "an account with that email already exists")
		case errors.Is(err, auth.ErrInvalidEmail), errors.Is(err, auth.ErrWeakPassword):
			fail(w, http.StatusBadRequest, "invalid_request", err.Error())
		default:
			dbfail(w)
		}
		return
	}
	write(w, http.StatusCreated, envelope{"data": session})
}

func (s *Server) signIn(w http.ResponseWriter, r *http.Request) {
	setAuthNoStore(w)
	var input credentials
	if body(r, &input) != nil {
		fail(w, http.StatusBadRequest, "invalid_request", "email and password are required")
		return
	}
	session, err := s.Auth.SignIn(r.Context(), input.Email, input.Password)
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrNotConfigured):
			authUnavailable(w)
		case errors.Is(err, auth.ErrInvalidCredentials):
			fail(w, http.StatusUnauthorized, "unauthorized", "email or password is incorrect")
		default:
			dbfail(w)
		}
		return
	}
	write(w, http.StatusOK, envelope{"data": session})
}

func (s *Server) signOut(w http.ResponseWriter, r *http.Request) {
	setAuthNoStore(w)
	if err := s.Auth.Revoke(r.Context(), r.Header.Get("Authorization")); err != nil {
		if errors.Is(err, auth.ErrNotConfigured) {
			authUnavailable(w)
		} else if errors.Is(err, auth.ErrUnauthenticated) {
			fail(w, http.StatusUnauthorized, "unauthorized", "a valid bearer token is required")
		} else {
			dbfail(w)
		}
		return
	}
	write(w, http.StatusOK, envelope{"data": map[string]bool{"signed_out": true}})
}

func (s *Server) currentAccount(w http.ResponseWriter, r *http.Request) {
	setAuthNoStore(w)
	user, err := s.Auth.Validate(r.Context(), r.Header.Get("Authorization"))
	if err != nil {
		if errors.Is(err, auth.ErrNotConfigured) {
			authUnavailable(w)
		} else if errors.Is(err, auth.ErrUnauthenticated) {
			fail(w, http.StatusUnauthorized, "unauthorized", "a valid bearer token is required")
		} else {
			dbfail(w)
		}
		return
	}
	write(w, http.StatusOK, envelope{"data": user})
}
