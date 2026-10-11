package config

import (
	"os"
	"strings"
	"time"
)

type Config struct {
	Addr, DatabaseURL, SupabaseURL, SupabaseAnonKey, AIServiceURL, AIServiceToken string
	CORSAllowedOrigins                                                            []string
	DemoReads                                                                     bool
	AIMatchingEnabled                                                             bool
	AuthTimeout                                                                   time.Duration
}

func Load() Config {
	return Config{Addr: ":" + env("PORT", "8080"), DatabaseURL: os.Getenv("DATABASE_URL"), SupabaseURL: strings.TrimRight(os.Getenv("SUPABASE_URL"), "/"), SupabaseAnonKey: os.Getenv("SUPABASE_ANON_KEY"), AIServiceURL: env("AI_SERVICE_URL", "http://ai:8090"), AIServiceToken: os.Getenv("AI_SERVICE_TOKEN"), CORSAllowedOrigins: origins(env("CORS_ALLOWED_ORIGINS", "http://localhost:3000")), DemoReads: strings.EqualFold(os.Getenv("DEMO_READS"), "true"), AIMatchingEnabled: strings.EqualFold(os.Getenv("AI_MATCHING_ENABLED"), "true"), AuthTimeout: 4 * time.Second}
}
func env(k, d string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return d
}

func origins(v string) []string {
	out := []string{}
	for _, x := range strings.Split(v, ",") {
		x = strings.TrimSpace(x)
		if x != "" {
			out = append(out, x)
		}
	}
	return out
}
