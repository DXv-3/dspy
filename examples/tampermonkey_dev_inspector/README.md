# Tampermonkey Dev Inspector example stack

This folder contains a tiny FastAPI service plus a static dashboard that work with the Dev Inspector helper script. Use it as a reference implementation or as a starting point for your own logging pipeline.

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload
```

The backend exposes three endpoints:

- `POST /events` – store a selection payload (auth optional via `Authorization: Bearer <key>` header)
- `GET /events` – list stored events (in memory)
- `POST /reset` – clear the in-memory store

Set `INSPECTOR_API_KEY` in the environment if you want to require a key.

## Frontend dashboard

Open `frontend/index.html` in any browser. Enter the backend URL (`http://localhost:8000/events` when running locally) and the API key if needed. The dashboard polls every few seconds and renders:

- when each selection arrived
- the page it came from
- both selectors
- the snippet payload forwarded by the helper

Feel free to adapt the markup or swap the polling logic with websockets if you need real-time updates.
