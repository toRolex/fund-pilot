.PHONY: dev dev-backend dev-frontend

dev:
	@echo "Starting backend on :8000 and frontend on :5173"
	cd backend && uv run uvicorn app.main:app --reload --port 8000 &
	cd frontend && npx vite --port 5173
	# ponytail: background backend process, use tmux/tmuxinator if dev scales up

dev-backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npx vite --port 5173
