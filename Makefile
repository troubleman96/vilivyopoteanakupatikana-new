.PHONY: setup web-dev web-typecheck web-build web-lint api-run api-test ai-setup ai-test test up down

setup:
	pnpm install --ignore-scripts
	python3 -m pip install -e 'services/ai[test]'

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

ai-setup:
	python3 -m pip install -e 'services/ai[test]'

ai-test:
	cd services/ai && python3 -m pytest -q

test: web-typecheck web-lint api-test ai-test

up:
	docker compose up --build

down:
	docker compose down
