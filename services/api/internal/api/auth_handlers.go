package api

import (
	"errors"
	"math"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/auth"
)

type credentials struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type emailInput struct {
	Email string `json:"email"`
}

type tokenInput struct {
	Token string `json:"token"`
}

func setAuthNoStore(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-store, private")
	w.Header().Set("Referrer-Policy", "no-referrer")
}

func authUnavailable(w http.ResponseWriter) {
	fail(w, http.StatusServiceUnavailable, "auth_unavailable", "local authentication requires a configured PostgreSQL database")
}

func requestAddress(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err == nil && host != "" {
		return host
	}
	if r.RemoteAddr == "" {
		return "unknown"
	}
	return r.RemoteAddr
}

func (s *Server) allowAuthRate(w http.ResponseWriter, r *http.Request, scope, key string, limit int, window time.Duration) bool {
	retry, err := s.Auth.RateLimit(r.Context(), scope, key, limit, window)
	if err != nil {
		if errors.Is(err, auth.ErrNotConfigured) {
			authUnavailable(w)
		} else {
			dbfail(w)
		}
		return false
	}
	if retry > 0 {
		seconds := int(math.Ceil(retry.Seconds()))
		if seconds < 1 {
			seconds = 1
		}
		w.Header().Set("Retry-After", strconv.Itoa(seconds))
		fail(w, http.StatusTooManyRequests, "rate_limited", "too many authentication attempts; try again later")
		return false
	}
	return true
}

func (s *Server) registerAccount(w http.ResponseWriter, r *http.Request) {
	setAuthNoStore(w)
	if !s.allowAuthRate(w, r, "register-ip", requestAddress(r), 5, time.Hour) {
		return
	}
	var input credentials
	if body(r, &input) != nil {
		fail(w, http.StatusBadRequest, "invalid_request", "email and password are required")
		return
	}
	if err := s.Auth.Register(r.Context(), input.Email, input.Password); err != nil {
		switch {
		case errors.Is(err, auth.ErrNotConfigured):
			authUnavailable(w)
		case errors.Is(err, auth.ErrEmailTaken):
			if resendErr := s.Auth.ResendVerification(r.Context(), input.Email); resendErr != nil {
				dbfail(w)
				return
			}
			write(w, http.StatusAccepted, envelope{"data": map[string]string{"message": "If this address is eligible, a verification link has been added to the local mail outbox."}})
			return
		case errors.Is(err, auth.ErrInvalidEmail), errors.Is(err, auth.ErrWeakPassword):
			fail(w, http.StatusBadRequest, "invalid_request", err.Error())
		default:
			dbfail(w)
		}
		return
	}
	write(w, http.StatusAccepted, envelope{"data": map[string]string{"message": "If this address is eligible, a verification link has been added to the local mail outbox."}})
}

func (s *Server) signIn(w http.ResponseWriter, r *http.Request) {
	setAuthNoStore(w)
	if !s.allowAuthRate(w, r, "login-ip", requestAddress(r), 25, 15*time.Minute) {
		return
	}
	var input credentials
	if body(r, &input) != nil {
		fail(w, http.StatusBadRequest, "invalid_request", "email and password are required")
		return
	}
	accountKey := strings.ToLower(strings.TrimSpace(input.Email))
	if !s.allowAuthRate(w, r, "login-account", accountKey, 6, 15*time.Minute) {
		return
	}
	session, err := s.Auth.SignIn(r.Context(), input.Email, input.Password)
	if err != nil {
		switch {
		case errors.Is(err, auth.ErrNotConfigured):
			authUnavailable(w)
		case errors.Is(err, auth.ErrEmailNotVerified):
			fail(w, http.StatusForbidden, "email_not_verified", "verify your email before signing in, or request a new verification link")
		case errors.Is(err, auth.ErrInvalidCredentials):
			fail(w, http.StatusUnauthorized, "unauthorized", "email or password is incorrect")
		default:
			dbfail(w)
		}
		return
	}
	setSessionCookie(w, session, s.Auth.CookieSecure)
	write(w, http.StatusOK, envelope{"data": session})
}

func (s *Server) verifyEmail(w http.ResponseWriter, r *http.Request) {
	setAuthNoStore(w)
	if !s.allowAuthRate(w, r, "verify-ip", requestAddress(r), 10, 15*time.Minute) {
		return
	}
	var input tokenInput
	if body(r, &input) != nil || input.Token == "" {
		fail(w, http.StatusBadRequest, "invalid_request", "a verification token is required")
		return
	}
	if err := s.Auth.VerifyEmail(r.Context(), input.Token); err != nil {
		switch {
		case errors.Is(err, auth.ErrNotConfigured):
			authUnavailable(w)
		case errors.Is(err, auth.ErrInvalidToken):
			fail(w, http.StatusBadRequest, "invalid_link", "this verification link is invalid, expired, or already used")
		default:
			dbfail(w)
		}
		return
	}
	write(w, http.StatusOK, envelope{"data": map[string]string{"message": "Email verified. You can now sign in."}})
}

func (s *Server) resendVerification(w http.ResponseWriter, r *http.Request) {
	setAuthNoStore(w)
	if !s.allowAuthRate(w, r, "verify-request-ip", requestAddress(r), 5, time.Hour) {
		return
	}
	var input emailInput
	if body(r, &input) != nil {
		fail(w, http.StatusBadRequest, "invalid_request", "an email address is required")
		return
	}
	if !s.allowAuthRate(w, r, "verify-request-email", strings.ToLower(strings.TrimSpace(input.Email)), 3, 15*time.Minute) {
		return
	}
	if err := s.Auth.ResendVerification(r.Context(), input.Email); err != nil {
		if errors.Is(err, auth.ErrNotConfigured) {
			authUnavailable(w)
		} else {
			dbfail(w)
		}
		return
	}
	write(w, http.StatusAccepted, envelope{"data": map[string]string{"message": "If the account needs verification, a link has been added to the local mail outbox."}})
}

func (s *Server) requestPasswordReset(w http.ResponseWriter, r *http.Request) {
	setAuthNoStore(w)
	if !s.allowAuthRate(w, r, "reset-request-ip", requestAddress(r), 5, time.Hour) {
		return
	}
	var input emailInput
	if body(r, &input) != nil {
		fail(w, http.StatusBadRequest, "invalid_request", "an email address is required")
		return
	}
	if !s.allowAuthRate(w, r, "reset-request-email", strings.ToLower(strings.TrimSpace(input.Email)), 3, 15*time.Minute) {
		return
	}
	if err := s.Auth.RequestPasswordReset(r.Context(), input.Email); err != nil {
		if errors.Is(err, auth.ErrNotConfigured) {
			authUnavailable(w)
		} else {
			dbfail(w)
		}
		return
	}
	write(w, http.StatusAccepted, envelope{"data": map[string]string{"message": "If an active account matches that address, password reset instructions have been added to the local mail outbox."}})
}

func (s *Server) resetPassword(w http.ResponseWriter, r *http.Request) {
	setAuthNoStore(w)
	if !s.allowAuthRate(w, r, "reset-confirm-ip", requestAddress(r), 10, time.Hour) {
		return
	}
	var input credentialsWithToken
	if body(r, &input) != nil || input.Token == "" {
		fail(w, http.StatusBadRequest, "invalid_request", "a reset token and new password are required")
		return
	}
	if err := s.Auth.ResetPassword(r.Context(), input.Token, input.Password); err != nil {
		switch {
		case errors.Is(err, auth.ErrNotConfigured):
			authUnavailable(w)
		case errors.Is(err, auth.ErrWeakPassword):
			fail(w, http.StatusBadRequest, "invalid_request", err.Error())
		case errors.Is(err, auth.ErrInvalidToken):
			fail(w, http.StatusBadRequest, "invalid_link", "this password reset link is invalid, expired, or already used")
		default:
			dbfail(w)
		}
		return
	}
	clearSessionCookie(w, s.Auth.CookieSecure)
	write(w, http.StatusOK, envelope{"data": map[string]string{"message": "Password updated. All existing sessions have been revoked; sign in with the new password."}})
}

type credentialsWithToken struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

func (s *Server) signOut(w http.ResponseWriter, r *http.Request) {
	setAuthNoStore(w)
	if err := s.Auth.Revoke(r.Context(), requestAuthHeader(r)); err != nil {
		if errors.Is(err, auth.ErrNotConfigured) {
			authUnavailable(w)
		} else if errors.Is(err, auth.ErrUnauthenticated) {
			fail(w, http.StatusUnauthorized, "unauthorized", "a valid session is required")
		} else {
			dbfail(w)
		}
		clearSessionCookie(w, s.Auth.CookieSecure)
		return
	}
	clearSessionCookie(w, s.Auth.CookieSecure)
	write(w, http.StatusOK, envelope{"data": map[string]bool{"signed_out": true}})
}

func (s *Server) signOutAll(w http.ResponseWriter, r *http.Request) {
	setAuthNoStore(w)
	if err := s.Auth.RevokeAll(r.Context(), requestAuthHeader(r)); err != nil {
		if errors.Is(err, auth.ErrNotConfigured) {
			authUnavailable(w)
		} else if errors.Is(err, auth.ErrUnauthenticated) {
			fail(w, http.StatusUnauthorized, "unauthorized", "a valid session is required")
		} else {
			dbfail(w)
		}
		clearSessionCookie(w, s.Auth.CookieSecure)
		return
	}
	clearSessionCookie(w, s.Auth.CookieSecure)
	write(w, http.StatusOK, envelope{"data": map[string]bool{"signed_out_everywhere": true}})
}

func (s *Server) currentAccount(w http.ResponseWriter, r *http.Request) {
	setAuthNoStore(w)
	user, err := s.Auth.Validate(r.Context(), requestAuthHeader(r))
	if err != nil {
		if errors.Is(err, auth.ErrNotConfigured) {
			authUnavailable(w)
		} else if errors.Is(err, auth.ErrUnauthenticated) {
			fail(w, http.StatusUnauthorized, "unauthorized", "a valid session is required")
		} else {
			dbfail(w)
		}
		return
	}
	write(w, http.StatusOK, envelope{"data": user})
}

func requestAuthHeader(r *http.Request) string {
	if header := r.Header.Get("Authorization"); header != "" {
		return header
	}
	cookie, err := r.Cookie(auth.SessionCookieName)
	if err != nil || cookie.Value == "" {
		return ""
	}
	return "Bearer " + cookie.Value
}

func setSessionCookie(w http.ResponseWriter, session auth.Session, secure bool) {
	maxAge := int(time.Until(session.ExpiresAt).Seconds())
	if maxAge < 0 {
		maxAge = 0
	}
	http.SetCookie(w, &http.Cookie{
		Name:     auth.SessionCookieName,
		Value:    session.AccessToken,
		Path:     "/",
		Expires:  session.ExpiresAt,
		MaxAge:   maxAge,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
}

func clearSessionCookie(w http.ResponseWriter, secure bool) {
	http.SetCookie(w, &http.Cookie{
		Name:     auth.SessionCookieName,
		Value:    "",
		Path:     "/",
		Expires:  time.Unix(1, 0),
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	})
}
