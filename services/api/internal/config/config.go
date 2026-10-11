package config

import (
	"fmt"
	"os"
	"strings"
)

type Config struct {
	Addr, DatabaseURL, AIServiceURL, AIServiceToken string
	PublicAppURL                                    string
	CORSAllowedOrigins                              []string
	TrustedProxyCIDRs                               []string
	AIMatchingEnabled                               bool
}

func Load() (Config, error) {
	databaseURL, err := SecretEnv("DATABASE_URL")
	if err != nil {
		return Config{}, err
	}
	aiToken, err := SecretEnv("AI_SERVICE_TOKEN")
	if err != nil {
		return Config{}, err
	}
	return Config{
		Addr:               ":" + env("PORT", "8080"),
		DatabaseURL:        databaseURL,
		AIServiceURL:       env("AI_SERVICE_URL", "http://ai:8090"),
		AIServiceToken:     aiToken,
		PublicAppURL:       env("PUBLIC_APP_URL", "http://localhost:3000"),
		CORSAllowedOrigins: origins(env("CORS_ALLOWED_ORIGINS", "http://localhost:3000")),
		TrustedProxyCIDRs:  origins(os.Getenv("TRUSTED_PROXY_CIDRS")),
		AIMatchingEnabled:  strings.EqualFold(os.Getenv("AI_MATCHING_ENABLED"), "true"),
	}, nil
}

// SecretEnv reads a value from NAME_FILE when configured, without exposing the
// contents in logs. A non-empty inline value and a file path are ambiguous and
// rejected so production secret injection cannot silently fall back.
func SecretEnv(name string) (string, error) {
	value := os.Getenv(name)
	path := strings.TrimSpace(os.Getenv(name + "_FILE"))
	if path == "" {
		return value, nil
	}
	if value != "" {
		return "", fmt.Errorf("configure either %s or %s_FILE, not both", name, name)
	}
	contents, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("read %s_FILE: %w", name, err)
	}
	secret := strings.TrimRight(string(contents), "\r\n")
	if secret == "" {
		return "", fmt.Errorf("%s_FILE is empty", name)
	}
	return secret, nil
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
