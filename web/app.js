const TOKEN_KEY = "sbt_token";
const USER_KEY = "sbt_user";

const RENDER_API = "https://school-bus-api.onrender.com";
const STATIC_PORTS = new Set(["3000", "5173", "5500", "8080", "8081"]);

function apiBase() {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("api");
  if (fromQuery) return fromQuery.replace(/\/$/, "");
  const saved = localStorage.getItem("sbt_api");
  if (saved) return saved.replace(/\/$/, "");
  const host = location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    if (STATIC_PORTS.has(location.port)) return "http://127.0.0.1:8000";
    return location.origin;
  }
  if (host.endsWith("onrender.com")) return location.origin;
  return RENDER_API;
}

function wsBase() {
  return apiBase().replace(/^http/, "ws");
}

let token = localStorage.getItem(TOKEN_KEY);
let user = JSON.parse(localStorage.getItem(USER_KEY) || "null");
let socket = null;
let map = null;
let markersLayer = null;
let routeLayer = null;
let pollTimer = null;
let selectedChild = 0;

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const main = document.getElementById("main");
const tabs = document.getElementById("tabs");
const who = document.getElementById("who");
const loginError = document.getElementById("login-error");

function isAdmin(role) {
  return role === "admin" || role === "customer_admin" || role === "product_admin";
}

async function request(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`${apiBase()}${path}`, { ...options, headers });
  } catch {
    throw new Error(`Cannot reach API at ${apiBase()}`);
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`API returned non-JSON (${res.status})`);
    }
  }
  if (!res.ok) {
    const detail = data && data.detail;
    if (typeof detail === "string") throw new Error(detail);
    throw new Error(`Request failed (${res.status})`);
  }
  return data;
}

function closeSocket() {
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
}

function openSocket(path, onMessage) {
  closeSocket();
  const url = `${wsBase()}${path}?token=${encodeURIComponent(token || "")}`;
  socket = new WebSocket(url);
  socket.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      /* ignore */
    }
  };
  socket.onclose = () => {
    socket = null;
    setTimeout(() => {
      if (token) openSocket(path, onMessage);
    }, 2000);
  };
}

function destroyMap() {
  if (map) {
    map.remove();
    map = null;
    markersLayer = null;
    routeLayer = null;
  }
}

function ensureMap(center) {
  const el = document.getElementById("map");
  if (!el) return;
  if (!map) {
    map = L.map(el).setView(center, 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    routeLayer = L.layerGroup().addTo(map);
    markersLayer = L.layerGroup().addTo(map);
  }
  setTimeout(() => map.invalidateSize(), 50);
}

function setMapData({ bus, stop, stops, buses, onMapClick }) {
  const points = [];
  if (bus && bus.current_lat != null && bus.current_lng != null) {
    points.push([bus.current_lat, bus.current_lng]);
  }
  if (stop) points.push([stop.lat, stop.lng]);
  (buses || []).forEach((b) => {
    if (b.current_lat != null && b.current_lng != null) points.push([b.current_lat, b.current_lng]);
  });
  const center = points[0] || [12.9716, 77.5946];
  ensureMap(center);
  if (!map) return;

  routeLayer.clearLayers();
  markersLayer.clearLayers();

  if (stops && stops.length) {
    const line = [...stops]
      .sort((a, b) => a.sequence_number - b.sequence_number)
      .map((s) => [s.lat, s.lng]);
    L.polyline(line, { color: "#1c4e7a", weight: 4 }).addTo(routeLayer);
  }

  if (stop) {
    L.circleMarker([stop.lat, stop.lng], {
      radius: 8,
      color: "#fff",
      weight: 2,
      fillColor: "#1c4e7a",
      fillOpacity: 1,
    })
      .bindTooltip(stop.name)
      .addTo(markersLayer);
  }

  const busList = buses || (bus ? [bus] : []);
  busList.forEach((item) => {
    if (item.current_lat == null || item.current_lng == null) return;
    const warn = item.is_stale || item.status === "signal_lost";
    L.circleMarker([item.current_lat, item.current_lng], {
      radius: 11,
      color: "#fff",
      weight: 3,
      fillColor: warn ? "#c46a1b" : "#1b7f4e",
      fillOpacity: 1,
    })
      .bindTooltip(item.bus_number || "Bus")
      .addTo(markersLayer);
  });

  if (onMapClick) {
    map.off("click");
    map.on("click", (e) => onMapClick(e.latlng.lat, e.latlng.lng));
  }

  if (points.length > 1) map.fitBounds(points, { padding: [28, 28] });
  else if (points.length === 1) map.setView(points[0], 15);
}

function toneOf(bus) {
  if (!bus) return { label: "No bus assigned yet", tone: "idle" };
  if (bus.status === "signal_lost" || bus.is_stale) {
    return { label: "Signal weak — last known location", tone: "warn" };
  }
  if (bus.trip_active || bus.status === "active") return { label: "Bus is live on the route", tone: "live" };
  return { label: "Trip not started", tone: "idle" };
}

function alertTitle(item) {
  if (item.type === "school_arrived") return "Arrived at school";
  if (item.type === "5_min_warning") return "Bus is about 5 minutes away";
  if (item.type === "eta_warning") return "Bus is almost at your stop";
  if (item.message) return item.message;
  return (item.type || "alert").replace(/_/g, " ");
}

function showLogin() {
  closeSocket();
  destroyMap();
  if (pollTimer) clearInterval(pollTimer);
  loginView.hidden = false;
  appView.hidden = true;
}

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
  who.textContent = `${user.name} · ${user.role}`;
  const role = user.role;
  if (role === "parent") {
    tabs.innerHTML =
      '<button data-tab="track" class="active" type="button">Track</button>' +
      '<button data-tab="alerts" type="button">Alerts</button>';
    loadParentTrack();
  } else if (role === "driver") {
    tabs.innerHTML = '<button data-tab="drive" class="active" type="button">Trip</button>';
    loadDriver();
  } else {
    tabs.innerHTML =
      '<button data-tab="fleet" class="active" type="button">Fleet</button>' +
      '<button data-tab="alerts" type="button">Alerts</button>';
    loadAdminFleet();
  }
}

function setActiveTab(tab) {
  [...tabs.querySelectorAll("button")].forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
}

tabs.addEventListener("click", (event) => {
  const btn = event.target.closest("button");
  if (!btn) return;
  setActiveTab(btn.dataset.tab);
  destroyMap();
  closeSocket();
  if (pollTimer) clearInterval(pollTimer);
  if (btn.dataset.tab === "track") loadParentTrack();
  if (btn.dataset.tab === "alerts" && user.role === "parent") loadParentAlerts();
  if (btn.dataset.tab === "fleet") loadAdminFleet();
  if (btn.dataset.tab === "alerts" && isAdmin(user.role)) loadAdminAlerts();
  if (btn.dataset.tab === "drive") loadDriver();
});

document.getElementById("login-btn").addEventListener("click", async () => {
  loginError.hidden = true;
  const btn = document.getElementById("login-btn");
  btn.disabled = true;
  try {
    const res = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("email").value.trim().toLowerCase(),
        password: document.getElementById("password").value,
      }),
    });
    token = res.access_token;
    user = res.user;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    showApp();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.hidden = false;
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("logout-btn").addEventListener("click", () => {
  token = null;
  user = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  showLogin();
});

function renderAlerts(items) {
  if (!items.length) {
    main.innerHTML = '<div class="card empty">No alerts yet.</div>';
    return;
  }
  main.innerHTML = `<div class="alert-list">${items
    .map((item) => {
      const when = item.sent_at ? new Date(item.sent_at).toLocaleString() : "";
      const klass = item.type === "emergency" ? "alert emergency" : "alert";
      return `<div class="${klass}"><strong>${alertTitle(item)}</strong><div class="muted">${when}</div></div>`;
    })
    .join("")}</div>`;
}

async function loadParentTrack() {
  if (pollTimer) clearInterval(pollTimer);
  closeSocket();
  destroyMap();
  main.innerHTML = '<p class="muted">Loading your child’s bus…</p>';
  let children = [];
  try {
    children = await request("/api/parent/children");
  } catch (err) {
    main.innerHTML = `<p class="error">${err.message}</p>`;
    return;
  }
  selectedChild = Math.min(selectedChild, Math.max(children.length - 1, 0));

  const paint = (bundle, all, bindSocket) => {
    destroyMap();
    const student = bundle && bundle.student;
    const bus = bundle && bundle.bus;
    const stop = bundle && bundle.stop;
    const eta = bundle && bundle.eta;
    const status = toneOf(bus);
    const chips =
      all.length > 1
        ? `<div class="chips">${all
            .map(
              (c, i) =>
                `<button class="chip${i === selectedChild ? " active" : ""}" data-child="${i}" type="button">${c.student.name}</button>`,
            )
            .join("")}</div>`
        : "";

    if (!student) {
      main.innerHTML = `${chips}<div class="card">No child linked yet. Ask your school admin to assign a stop.</div>`;
      return;
    }

    const etaLine =
      eta && eta.eta_minutes != null && !bundle.school_arrived && !student.boarded
        ? `<div>${eta.eta_minutes} min to ${eta.target_name || "pickup"}</div>`
        : student.boarded
          ? "<div>Child is boarded — waiting for school arrival</div>"
          : "";

    main.innerHTML = `
      ${chips}
      <div class="card status">
        <div class="dot ${status.tone}"></div>
        <div>
          <strong>${status.label}</strong>
          <div>${student.name}${bus ? ` · ${bus.bus_number}` : ""}</div>
          ${etaLine}
          <div class="muted">${stop ? stop.name : "No stop"} · last update ${
            bus && bus.last_updated_at ? new Date(bus.last_updated_at).toLocaleTimeString() : "—"
          }</div>
        </div>
      </div>
      <button id="board-btn" type="button">${student.boarded ? "Undo boarded" : "Mark as boarded"}</button>
      <div id="map" class="map"></div>
    `;

    document.getElementById("board-btn").onclick = async () => {
      try {
        await request(`/api/parent/students/${student.id}/board`, {
          method: "POST",
          body: JSON.stringify({ boarded: !student.boarded }),
        });
        loadParentTrack();
      } catch (err) {
        alert(err.message);
      }
    };

    main.querySelectorAll("[data-child]").forEach((btn) => {
      btn.onclick = () => {
        selectedChild = Number(btn.dataset.child);
        loadParentTrack();
      };
    });

    setMapData({ bus, stop, stops: bundle.route && bundle.route.stops });
    if (bindSocket && bus && bus.id) {
      openSocket(`/ws/track/${bus.id}`, (msg) => {
        if (msg.bus) {
          children[selectedChild] = { ...bundle, bus: msg.bus };
          setMapData({ bus: msg.bus, stop, stops: bundle.route && bundle.route.stops });
        }
      });
    }
  };

  paint(children[selectedChild], children, true);
  pollTimer = setInterval(async () => {
    try {
      children = await request("/api/parent/children");
      paint(children[selectedChild], children, false);
    } catch {
      /* keep */
    }
  }, 5000);
}

async function loadParentAlerts() {
  main.innerHTML = '<p class="muted">Loading alerts…</p>';
  try {
    renderAlerts(await request("/api/parent/alerts"));
  } catch (err) {
    main.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

async function loadAdminFleet() {
  main.innerHTML = '<p class="muted">Loading fleet…</p>';
  let buses = [];
  try {
    buses = await request("/api/buses");
  } catch (err) {
    main.innerHTML = `<p class="error">${err.message}</p>`;
    return;
  }

  const rowsHtml = (list) =>
    list
      .map((bus) => {
        const status = toneOf(bus);
        return `<div class="row"><div><strong>${bus.bus_number}</strong><div class="muted">${status.label}</div></div><div class="dot ${status.tone}"></div></div>`;
      })
      .join("") || '<div class="empty">No buses</div>';

  main.innerHTML = `<div class="card" id="fleet-rows">${rowsHtml(buses)}</div><div id="map" class="map"></div>`;
  setMapData({ buses });
  openSocket("/ws/admin", (msg) => {
    if (!msg.bus) return;
    const idx = buses.findIndex((b) => b.id === msg.bus.id);
    if (idx === -1) buses.push(msg.bus);
    else buses[idx] = msg.bus;
    const rows = document.getElementById("fleet-rows");
    if (rows) rows.innerHTML = rowsHtml(buses);
    setMapData({ buses });
  });
}

async function loadAdminAlerts() {
  main.innerHTML = '<p class="muted">Loading alerts…</p>';
  try {
    renderAlerts(await request("/api/admin/alerts"));
  } catch (err) {
    main.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

async function loadDriver() {
  main.innerHTML = '<p class="muted">Loading bus…</p>';
  let payload;
  try {
    payload = await request("/api/buses/mine");
  } catch (err) {
    main.innerHTML = `<p class="error">${err.message}</p><p class="muted">Background GPS still needs the Android app. This page is for a browser demo.</p>`;
    return;
  }

  const bus = payload.bus;
  const route = payload.route;
  const paint = (current) => {
    destroyMap();
    const status = toneOf(current);
    main.innerHTML = `
      <div class="card status">
        <div class="dot ${status.tone}"></div>
        <div>
          <strong>${current.bus_number}</strong>
          <div>${status.label}</div>
          <div class="muted">Tap the map to send a GPS point (demo). Real trips use the Android APK.</div>
        </div>
      </div>
      <button id="trip-btn" type="button">${current.trip_active ? "End trip" : "Start trip"}</button>
      <div id="map" class="map"></div>
    `;
    document.getElementById("trip-btn").onclick = async () => {
      const action = current.trip_active ? "end-trip" : "start-trip";
      try {
        const res = await request(`/api/buses/${current.id}/${action}`, { method: "POST" });
        paint(res.bus || current);
      } catch (err) {
        alert(err.message);
      }
    };
    setMapData({
      bus: current,
      stops: route && route.stops,
      onMapClick: async (lat, lng) => {
        try {
          const res = await request("/api/location/latest", {
            method: "POST",
            body: JSON.stringify({
              bus_id: current.id,
              lat,
              lng,
              speed: null,
              recorded_at: new Date().toISOString(),
            }),
          });
          if (res.bus) paint(res.bus);
        } catch (err) {
          alert(err.message);
        }
      },
    });
  };

  paint(bus);
}

if (token && user) showApp();
else showLogin();
