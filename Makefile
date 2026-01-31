start:
	lsof -ti :8000 | xargs kill -9
	lsof -ti :5500 | xargs kill -9
	cd backend && \
	python3 -m venv venv || true && \
	source venv/bin/activate && \
	pip install -r requirements.txt && \
	python -m uvicorn app.main:app --reload --port 8000 & \
	cd frontend && \
	python3 -m http.server 5500
