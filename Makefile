.PHONY: help start-dev stop-dev start-prod stop-prod db-migrate db-migration-create test test-cov fabric-start fabric-stop

help:
	@echo "Available commands:"
	@echo "  start-dev            Start local development environment (Docker Compose)"
	@echo "  stop-dev             Stop local development environment"
	@echo "  start-prod           Start production-like environment"
	@echo "  stop-prod            Stop production-like environment"
	@echo "  db-migrate           Run database migrations (Alembic upgrade head)"
	@echo "  db-migration-create  Create new migration revision (usage: make db-migration-create m=\"migration_name\")"
	@echo "  test                 Run pytest suite"
	@echo "  fabric-start         Start Fabric blockchain test-network"
	@echo "  fabric-stop          Stop Fabric blockchain test-network"

start-dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d

stop-dev:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v

start-prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

stop-prod:
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down

db-migrate:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend alembic upgrade head

db-migration-create:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend alembic revision --autogenerate -m "$(m)"

test:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend pytest

fabric-start:
	bash ./blockchain/scripts/start-network.sh

fabric-stop:
	bash ./blockchain/scripts/stop-network.sh
