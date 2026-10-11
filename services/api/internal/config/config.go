package config

import (
	"os"
	"strings"
)

type Config struct {
	Addr, DatabaseURL, AIServiceURL, AIServiceToken string
	PublicAppURL                                    string
	CORSAllowedOrigins                              []string
	AIMatchingEnabled                               bool
}

func Load() Config {
	return Config{
		Addr:               ":" + env("PORT", "8080"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		AIServiceURL:       env("AI_SERVICE_URL", "http://ai:8090"),
		AIServiceToken:     os.Getenv("AI_SERVICE_TOKEN"),
		PublicAppURL:       env("PUBLIC_APP_URL", "http://localhost:3000"),
		CORSAllowedOrigins: origins(env("CORS_ALLOWED_ORIGINS", "http://localhost:3000")),
		AIMatchingEnabled:  strings.EqualFold(os.Getenv("AI_MATCHING_ENABLED"), "true"),
	}
}

func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func origins(value string) []string {
	out := []string{}
	for _, origin := range strings.Split(value, ",") {
		origin = strings.TrimSpace(origin)
		if origin != "" {
			out = append(out, origin)
		}
	}
	return out
}
