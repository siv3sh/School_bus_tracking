# School Bus Tracking — Phase 1

Expo SDK 57 (TypeScript) mobile app + FastAPI / MongoDB backend with live WebSocket tracking and offline-resilient GPS (latest point only).

## Quick start

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# MongoDB must be running on localhost:27017
python seed.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Seeded accounts (password `password123`):
- `admin@schoolbus.app`
- `driver@schoolbus.app`
- `parent1@schoolbus.app` / `parent2@schoolbus.app`

### Mobile

```bash
cd mobile-app
# Set extra.apiUrl in app.json to your machine LAN IP for a physical device
npx expo start --dev-client
```

Background GPS requires an **EAS development build** (not Expo Go):

```bash
cd mobile-app
npx eas-cli login   # if needed
npx eas build --profile development --platform android
```

On a physical device, set `expo.extra.apiUrl` in `app.json` to your computer's LAN IP (e.g. `http://192.168.1.10:8000`). Maps: Apple Maps on iOS; free OSM tiles via MapLibre on Android (no Google Maps API key).

## Phase 1 features

- Driver: Start/End trip, vibrate on start, next-stop checklist, boarded attendance, delay/emergency broadcast, simulate GPS
- Parent: live map + route polyline, watching chip, live ETA (haversine / optional OSRM), 5/10/15 min alert prefs, school contact links
- Admin: fleet map, routes with morning/evening/both schedule, assignments, alerts, trip audit log
- Backend: JWT roles, WebSockets, alert engine per parent preference, audit log, school contact settings

## Deploy API on Render

1. Create a MongoDB Atlas cluster and copy the connection string.
2. Connect this repo in [Render](https://render.com) (Blueprint uses `render.yaml`), or deploy `backend/` as a Docker web service.
3. Set `MONGODB_URI` (and optionally school contact / `JWT_SECRET`) in the service env.
4. After deploy, point `mobile-app/app.json` `extra.apiUrl` at the Render URL (e.g. `https://school-bus-api.onrender.com`).

Local Docker:

```bash
cd backend
docker build -t school-bus-api .
docker run --env-file .env -p 8000:8000 school-bus-api
```
