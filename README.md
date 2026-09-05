# School Bus Tracking

End-to-end **Phase 1** school bus tracker: parents watch a live bus map, drivers share GPS (or simulate it), and admins manage routes and the fleet.

| Layer | Stack |
|-------|--------|
| Mobile | Expo SDK 57, TypeScript, React Navigation, MapLibre (Android) / Apple Maps (iOS) |
| API | FastAPI, JWT roles, WebSockets, optional OSRM ETA |
| Data | MongoDB (local or Atlas) |

Repo: [github.com/siv3sh/School_bus_tracking](https://github.com/siv3sh/School_bus_tracking)

---

## What you get

**Driver**

- Start / end trip (phone vibrates on start)
- Live GPS while trip is active (background location on a **dev client** build)
- Mark next stop reached
- Delay / emergency broadcast to parents on the route
- **Tools → Simulate GPS** to test without driving (drag pin / tap map / jump to stops)

**Parent**

- Live map (bus pin, pickup stop, route line)
- Follow bus / show bus + stop camera modes
- ETA to pickup stop (until boarded)
- **Mark as boarded** (parent confirms child is on the bus)
- After boarding: no pickup ETA; wait for **Arrived at school**
- Alert prefs (5 / 10 / 15 min) and school contact on Profile
- Alerts tab: ETA warnings, delay/emergency, school arrival

**Admin**

- Fleet map of all buses
- Routes & stops (morning / evening / both schedule)
- Driver ↔ bus ↔ route assignments
- Alert log and trip audit log

**Backend**

- Role-based JWT (`driver` / `parent` / `admin`)
- Latest-point GPS only (offline: phone keeps one pending point, flushes on reconnect)
- WebSocket push to parents/admins + REST fallback
- Alert engine + school-arrival notifications

---

## Prerequisites

| Tool | Notes |
|------|--------|
| Python 3.11+ | Backend |
| Node 20+ | Mobile (Expo) |
| MongoDB 6+ | Local `mongod` **or** Atlas |
| Physical Android/iOS device | Same Wi‑Fi as your computer for local API |
| Expo account | For EAS development builds |
| macOS/Linux (or WSL) | Commands below use bash |

**Important:** Expo Go is **not** enough. MapLibre + background GPS need an **EAS development client** APK/IPA.

---

## Project layout

```text
school_bus_tracking/
├── README.md
├── render.yaml                 # Render blueprint for API
├── backend/
│   ├── Dockerfile
│   ├── .env.example
│   ├── requirements.txt
│   ├── seed.py                 # Demo users, route, bus, children
│   └── app/
│       ├── main.py
│       ├── routes/             # auth, buses, location, parent, admin
│       ├── services/           # ETA, alerts, school arrival, audit, push
│       └── websockets/
└── mobile-app/
    ├── app.json                # extra.apiUrl → your API base URL
    ├── eas.json
    └── src/                    # screens, map, API, sockets, GPS
```

---

## 1. Start MongoDB

### Option A — Local

```bash
# Example: data dir inside the repo (already gitignored)
mkdir -p .mongo-data
mongod --dbpath .mongo-data --port 27017 --bind_ip 127.0.0.1
```

Leave this terminal running. Health check:

```bash
mongosh --eval 'db.runCommand({ ping: 1 })'
```

### Option B — Atlas

1. Create a free cluster and a database user.
2. Allow your IP (or `0.0.0.0/0` for demos).
3. Copy the connection string (`mongodb+srv://...`).
4. Put it in `backend/.env` as `MONGODB_URI` (see below).

---

## 2. Run the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` if needed:

```env
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=school_bus_tracking
JWT_SECRET=change-me-in-production
HOST=0.0.0.0
PORT=8000
USE_OSRM=true
SCHOOL_NAME=Demo Public School
SCHOOL_PHONE=+91 90000 00000
SCHOOL_EMAIL=office@schoolbus.app
SCHOOL_ADDRESS=Main Campus Gate
```

Seed demo data (wipes users/routes/buses/students/alerts/audit for a clean demo):

```bash
PYTHONPATH=. python seed.py
```

Start the API so **phones on your LAN** can reach it (`0.0.0.0`, not only `127.0.0.1`):

```bash
PYTHONPATH=. uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Checks:

- Health: [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health) → `{"status":"ok"}`
- Docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### Seeded accounts

Password for all: **`password123`**

| Role | Email |
|------|--------|
| Admin | `admin@schoolbus.app` |
| Driver | `driver@schoolbus.app` |
| Parent (Aanya → Maple Avenue) | `parent1@schoolbus.app` |
| Parent (Rohan → Cedar Lane) | `parent2@schoolbus.app` |

Demo route **Morning Route A**: Oak Street → Maple Avenue → Cedar Lane → **School Gate**  
Bus: **BUS-101** (linked to the demo driver).

---

## 3. Configure the mobile app API URL

Phones cannot use `localhost`. Use your computer’s LAN IP.

```bash
# macOS example
ipconfig getifaddr en0
```

Edit `mobile-app/app.json`:

```json
"extra": {
  "apiUrl": "http://YOUR_LAN_IP:8000"
}
```

Example: `"apiUrl": "http://192.168.0.158:8000"`.

After changing `apiUrl`, reload the app (or rebuild if the value is baked into a production build). Development client usually picks it up from the Expo config on Metro reload.

`android.usesCleartextTraffic` is already `true` so HTTP on LAN works during development.

---

## 4. Install and build the mobile app

```bash
cd mobile-app
npm install
```

### Create a development build (once per device platform)

```bash
npx eas-cli login
npx eas build --profile development --platform android
```

For iOS (device):

```bash
npx eas build --profile development --platform ios
```

Install the APK/IPA from the EAS build page onto the phone.

### Start Metro

Backend and Mongo must already be running.

```bash
cd mobile-app
npx expo start --dev-client
```

Open the **dev client** app on the phone (same Wi‑Fi). Scan the QR code or enter the Metro URL.

---

## 5. End-to-end test (two phones)

Keep on your Mac:

1. `mongod`
2. `uvicorn ... --host 0.0.0.0 --port 8000`
3. `npx expo start --dev-client`

Both phones on the **same Wi‑Fi** as the Mac.

### Phone A — Driver

1. Login: `driver@schoolbus.app` / `password123`
2. Allow location (**Always** / while using, as prompted).
3. Tap **Start Trip** (should vibrate).
4. Prefer a controlled test: **Tools → Simulate GPS**
   - Tap **Prepare trip + socket**
   - Drag the green **DRAG** pin, tap the map, or tap stop chips (Oak → Maple → …)
   - Tap **Send current point**
5. On **Trip**: use **Mark stop reached** through the route until **School Gate**.
6. Optional: **Delay** / **Emergency** under Notify parents.
7. **End Trip** when done.

### Phone B — Parent

1. Login: `parent1@schoolbus.app` / `password123` (or `parent2@…`)
2. **Track**
   - Status should become live after the driver starts the trip
   - Map: green = bus, blue = pickup stop, line = route
   - Use **Follow bus** or **Show bus + stop** if the pin looks far away
3. When the child is on the bus, use the **Boarding** card → **Mark as boarded**  
   - Shows **Confirmed** / “is boarded”  
   - Pickup ETA hides after boarding
4. When the driver reaches **School Gate** (mark stop or GPS near school), parent gets:
   - Green **Arrived at school** banner on Track
   - Entry under **Alerts**
5. **Profile**: set alert minutes (5 / 10 / 15), open school contact links.
6. Pull to refresh anytime; Track also polls about every 5 seconds.

### Admin (optional third login)

Login: `admin@schoolbus.app` / `password123`

- **Fleet**: all buses on the map  
- **Manage**: routes, assignments, audit log  
- **Alerts**: system alert history  

---

## 6. How live tracking works

```text
Driver GPS / Simulate Send
        │
        ▼
  POST /api/location/latest  (+ optional driver WebSocket)
        │
        ├─► MongoDB (bus.current_lat/lng, last_updated_at)
        ├─► Alert engine (ETA prefs, auto stop-near, school arrival)
        └─► WebSocket /ws/track/{busId}  →  Parent & Admin maps
```

- Only the **bus** location is tracked (not the parent’s phone).
- ETA is bus → child’s **pickup stop** (or school target server-side after boarded; UI hides ETA once boarded).
- If GPS goes quiet &gt; ~30s on an active trip, status shows signal weak / last known point.

---

## 7. Useful API surface

Interactive docs: `/docs`

| Area | Examples |
|------|-----------|
| Auth | `POST /api/auth/login`, `GET /api/auth/me`, `PUT /api/auth/prefs` |
| Location | `POST /api/location/latest` |
| Driver bus | `GET /api/buses/mine`, `POST /api/buses/{id}/start-trip`, `end-trip`, `mark-stop-reached`, `broadcast` |
| Parent | `GET /api/parent/children`, `POST /api/parent/students/{id}/board`, `GET /api/parent/alerts` |
| Admin | `/api/admin/routes`, `/api/admin/buses/{id}/assign`, `/api/admin/alerts`, `/api/admin/audit` |
| WebSockets | `/ws/driver/{busId}`, `/ws/track/{busId}`, `/ws/admin` (token query param) |

---

## 8. Deploy API (Render + Atlas)

1. Create MongoDB Atlas; get `MONGODB_URI`.
2. In [Render](https://render.com), use **Blueprint** with this repo’s `render.yaml`, or create a Docker web service with:
   - Context: `backend/`
   - Dockerfile: `backend/Dockerfile`
   - Health check: `/health`
3. Set env vars at least:
   - `MONGODB_URI`
   - `MONGODB_DB=school_bus_tracking`
   - `JWT_SECRET` (strong random value)
   - Optional: `SCHOOL_*`, `USE_OSRM`
4. After deploy, open `https://YOUR-SERVICE.onrender.com/health`.
5. Seed once (Render shell or local against Atlas):

   ```bash
   cd backend && source .venv/bin/activate
   # .env pointed at Atlas
   PYTHONPATH=. python seed.py
   ```

6. Point `mobile-app/app.json` → `"apiUrl": "https://YOUR-SERVICE.onrender.com"` and reload/rebuild the app.

### Local Docker API

```bash
cd backend
docker build -t school-bus-api .
docker run --env-file .env -p 8000:8000 school-bus-api
```

---

## 9. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Login **JSON parse** / cannot reach API | Mongo or uvicorn down; API must bind `0.0.0.0`; phone `apiUrl` must be LAN IP or HTTPS Render URL; same Wi‑Fi |
| Parent map never moves | Driver must **Start Trip** and send GPS / Simulate **Send**; parent: pull refresh or wait ~5s; try **Show bus + stop** |
| Bus far from blue route | Demo stops are near **Bangalore**; real GPS elsewhere looks distant — use **Simulate GPS** on the demo stops |
| MapLibre `Unable to parse resourceUrl` | Use latest `AppMapView` (RasterSource + empty style, no glyph text layers); reload app |
| Expo Go / maps / background GPS fail | Use EAS **development** build, not Expo Go |
| Boarded checkbox only on parent | Intentional — parents confirm boarding; driver does not list student checkboxes |
| No school arrival | Mark stops until **School Gate**, or drive/simulate near the last stop (~150 m) |
| Seed emails rejected | Use `@schoolbus.app` accounts from seed (not `@school.test`) |

Quick login test from your computer:

```bash
curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"driver@schoolbus.app","password":"password123"}'
```

---

## 10. Daily restart checklist

```bash
# Terminal 1 — Mongo
mongod --dbpath .mongo-data --port 27017 --bind_ip 127.0.0.1

# Terminal 2 — API
cd backend && source .venv/bin/activate
PYTHONPATH=. uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 3 — Metro
cd mobile-app && npx expo start --dev-client
```

Confirm `app.json` `extra.apiUrl` still matches your current LAN IP if DHCP changed.

---

## License

Mobile app includes the Expo template license file under `mobile-app/LICENSE`. Backend and project docs are part of this repository for the school bus tracking Phase 1 demo.
