package main

import (
	"context"
	"errors"
	"log"
	"net/http"
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
	c := config.Load()
	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()
	var db *store.Store
	if c.DatabaseURL != "" {
		var e error
		db, e = store.Open(ctx, c.DatabaseURL)
		if e != nil {
			log.Printf("database unavailable; private operations disabled: %v", e)
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
	}, c.DemoReads, c.AIServiceURL)
	h.AIToken = c.AIServiceToken
	h.AIMatchingEnabled = c.AIMatchingEnabled
	h.CORSAllowedOrigins = c.CORSAllowedOrigins
	srv := &http.Server{Addr: c.Addr, Handler: h, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		<-ctx.Done()
		stop, c := context.WithTimeout(context.Background(), 8*time.Second)
		defer c()
		_ = srv.Shutdown(stop)
	}()
	log.Printf("API listening on %s", c.Addr)
	if e := srv.ListenAndServe(); e != nil && !errors.Is(e, http.ErrServerClosed) {
		log.Fatal(e)
	}
}
