start:
	@lsof -ti :8000 | xargs -r kill -9 || true
	@lsof -ti :5500 | xargs -r kill -9 || true
	@python3 -m venv backend/venv || true
	@. backend/venv/bin/activate && pip install -r backend/requirements.txt
	@. backend/venv/bin/activate && python -m uvicorn backend.app.main:app --reload --port 8000 & \
	  cd frontend && python3 -m http.server 5500