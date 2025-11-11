# Tampermonkey Dev Inspector – Full Stack Companion

This example pairs the Tampermonkey Dev Inspector userscript helper with a tiny FastAPI backend and a live dashboard so you can store selectors from any page and review them with your team.

## Architecture

```
Tampermonkey Helper ──▶ FastAPI backend (/events) ──▶ HTML dashboard (polls every 5s)
```

- **Frontend (`frontend/index.html`)** – a static dashboard that polls the backend and renders captured selectors, XPath expressions, and the generated snippet for each event.
- **Backend (`backend/app.py`)** – an in-memory FastAPI service that accepts POST requests from the helper. It stores events for the current session and exposes `GET /events` for the dashboard.

## Quick start

1. **Install dependencies and run the backend**

   ```bash
   cd examples/tampermonkey_dev_inspector/backend
   uv pip install -r requirements.txt
   uvicorn app:app --reload
   ```

   > The server listens on `http://localhost:8000`. Set the `INSPECTOR_API_KEY` environment variable if you want to require a bearer token.

2. **Open the dashboard**

   Open `examples/tampermonkey_dev_inspector/frontend/index.html` in your browser (double-click it or serve it with any static HTTP server). Enter the backend URL (defaults to `http://localhost:8000/events`) and optional API key, then click **Connect**.

3. **Configure the Tampermonkey helper**

   Add the following snippet _above_ the helper script in your userscript:

   ```javascript
   window.TampermonkeyInspectorConfig = {
     backend: {
       enabled: true,
       endpoint: 'http://localhost:8000/events',
       apiKey: 'dev-key', // Remove if you disabled API auth
       autoSend: true
     }
   };
   ```

   When you click **Add Step** inside the Dev Inspector panel the selection will be posted to the backend and show up on the dashboard.

4. **Reset the session**

   Call `POST /reset` (for example with `curl -X POST http://localhost:8000/reset`) to clear the in-memory store.

## Notes

- The backend stores events in-memory for simplicity. Swap the `EVENTS` list for your own database layer in production.
- The dashboard polls the backend every 5 seconds. Adjust the interval in `frontend/index.html` if you need real-time updates via Server-Sent Events or WebSockets.
- The inspector helper caches backend settings in `localStorage`, so you only need to configure the endpoint once per origin.
