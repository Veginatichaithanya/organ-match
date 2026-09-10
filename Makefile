.PHONY: help dev docker docker-down start-dev stop-dev start-prod stop-prod db-migrate db-migration-create seed test fabric-start fabric-stop

help:
	@echo "Available commands:"
	@echo "  dev                  Start local development environment (FastAPI + Vite concurrently)"
	@echo "  docker               Start full containerized monorepo (Postgres + Backend + Frontend + Nginx)"
	@echo "  docker-down          Stop full containerized monorepo"
	@echo "  seed                 Seed hospitals, roles, default users, and demo clinical data"
	@echo "  db-migrate           Run database migrations (Alembic upgrade head)"
	@echo "  db-migration-create  Create new migration revision (usage: make db-migration-create m=\"migration_name\")"
	@echo "  test                 Run pytest suite"
	@echo "  fabric-start         Start Fabric blockchain test-network"
	@echo "  fabric-stop          Stop Fabric blockchain test-network"

dev:
	./run.sh

docker:
	docker compose up --build

docker-down:
	docker compose down

start-dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d

stop-dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down

start-prod:
	docker compose up --build -d

stop-prod:
	docker compose down

seed:
	docker compose exec backend python scripts/seed_all.py

db-migrate:
	docker compose exec backend alembic upgrade head

db-migration-create:
	docker compose exec backend alembic revision --autogenerate -m "$(m)"

test:
	docker compose exec backend pytest

fabric-start:
	bash ./blockchain/scripts/start-network.sh

fabric-stop:
	bash ./blockchain/scripts/stop-network.sh
