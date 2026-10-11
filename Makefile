.PHONY: setup web-dev web-typecheck web-build web-lint api-run api-test api-test-50 ai-setup ai-test mcp-setup mcp-run mcp-test test up down

setup:
	pnpm install --ignore-scripts
	python3 -m pip install -e 'services/ai[test]' -e 'services/mcp[test]'

web-dev:
	pnpm dev

web-typecheck:
	pnpm typecheck

web-build:
	NEXT_PUBLIC_SENTRY_DISABLED=true pnpm build

web-lint:
	pnpm exec oxlint src/app src/components/vilivyopotea src/lib

api-run:
	cd services/api && go run ./cmd/api

api-test:
	cd services/api && go test ./...

api-test-50:
	@test -n "$(TEST_DATABASE_URL)" || (echo "Set TEST_DATABASE_URL to a dedicated local owner connection for a database whose name contains _test" >&2; exit 1)
	@test -n "$(TEST_APP_DATABASE_URL)" || (echo "Set TEST_APP_DATABASE_URL to the non-owner app role for that same test database" >&2; exit 1)
	@cd services/api && TEST_DATABASE_URL="$(TEST_DATABASE_URL)" TEST_APP_DATABASE_URL="$(TEST_APP_DATABASE_URL)" go test ./internal/api -run '^TestFiftyLocalPostgresAccountsAndIdentityHardening$$' -count=1 -v

ai-setup:
	python3 -m pip install -e 'services/ai[test]'

ai-test:
	cd services/ai && python3 -m pytest -q

mcp-setup:
	python3 -m pip install -e 'services/mcp[test]'

mcp-run:
	cd services/mcp && python3 server.py

mcp-test:
	cd services/mcp && python3 -m pytest -q

test: web-typecheck web-lint api-test ai-test mcp-test

up:
	docker compose up --build

down:
	docker compose down
