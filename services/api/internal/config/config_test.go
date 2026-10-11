package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSecretEnvReadsMountedFileWithoutTrimmingSecretContent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "db-url")
	if err := os.WriteFile(path, []byte("postgres://test:synthetic@localhost/test\r\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("DATABASE_URL", "")
	t.Setenv("DATABASE_URL_FILE", path)
	value, err := SecretEnv("DATABASE_URL")
	if err != nil {
		t.Fatal(err)
	}
	if value != "postgres://test:synthetic@localhost/test" {
		t.Fatalf("unexpected secret value after removing file newline")
	}
}

func TestSecretEnvRejectsMissingOrEmptyFiles(t *testing.T) {
	t.Setenv("AI_SERVICE_TOKEN", "")
	t.Setenv("AI_SERVICE_TOKEN_FILE", filepath.Join(t.TempDir(), "missing"))
	if _, err := SecretEnv("AI_SERVICE_TOKEN"); err == nil || !strings.Contains(err.Error(), "AI_SERVICE_TOKEN_FILE") {
		t.Fatalf("expected a named file-read error, got %v", err)
	}
	path := filepath.Join(t.TempDir(), "empty")
	if err := os.WriteFile(path, nil, 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("AI_SERVICE_TOKEN_FILE", path)
	if _, err := SecretEnv("AI_SERVICE_TOKEN"); err == nil || !strings.Contains(err.Error(), "empty") {
		t.Fatalf("expected empty-file error, got %v", err)
	}
}

func TestSecretEnvRejectsInlineAndFileValuesTogether(t *testing.T) {
	path := filepath.Join(t.TempDir(), "token")
	if err := os.WriteFile(path, []byte("file-secret"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("AI_SERVICE_TOKEN", "inline-secret")
	t.Setenv("AI_SERVICE_TOKEN_FILE", path)
	if _, err := SecretEnv("AI_SERVICE_TOKEN"); err == nil {
		t.Fatal("expected ambiguous secret source to be rejected")
	}
}
