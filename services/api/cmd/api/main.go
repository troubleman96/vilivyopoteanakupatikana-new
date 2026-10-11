package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/api"
	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/auth"
	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/config"
	"github.com/troubleman96/vilivyopoteanakupatikana-new/services/api/internal/store"
)

func main() {
	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, nil)))
	c, err := config.Load()
	if err != nil {
		slog.Error("invalid API configuration", "error", err)
		os.Exit(1)
	}
	if c.AIMatchingEnabled && c.AIServiceToken == "" {
		slog.Error("AI matching requires a configured internal service token")
		os.Exit(1)
	}
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()
	var db *store.Store
	if c.DatabaseURL != "" {
		db, err = store.Open(ctx, c.DatabaseURL)
		if err != nil {
			slog.Error("database unavailable; private operations disabled", "error", err)
		} else {
			defer db.Pool.Close()
		}
	}
	var authPool *pgxpool.Pool
	if db != nil {
		authPool = db.Pool
	}
	h := api.New(db, auth.Validator{
		Pool:         authPool,
		PublicAppURL: c.PublicAppURL,
		CookieSecure: true,
	}, c.AIServiceURL)
	h.AIToken = c.AIServiceToken
	h.AIMatchingEnabled = c.AIMatchingEnabled
	h.CORSAllowedOrigins = c.CORSAllowedOrigins
	if err := h.SetTrustedProxyCIDRs(c.TrustedProxyCIDRs); err != nil {
		slog.Error("invalid trusted proxy configuration", "error", err)
		os.Exit(1)
	}
	srv := &http.Server{Addr: c.Addr, Handler: h, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		<-ctx.Done()
		stop, c := context.WithTimeout(context.Background(), 8*time.Second)
		defer c()
		_ = srv.Shutdown(stop)
	}()
	slog.Info("API listening", "address", c.Addr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("API server stopped", "error", err)
		os.Exit(1)
	}
}
