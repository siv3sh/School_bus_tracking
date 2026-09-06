const TOKEN_KEY = "sbt_token";
const USER_KEY = "sbt_user";
const LIVE_API = "https://school-bus-tracking-tchy.onrender.com";
const STATIC_PORTS = new Set(["3000", "5173", "5500", "8080", "8081"]);

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function apiBase() {
  try {
    const saved = localStorage.getItem("sbt_api");
    if (saved && saved.includes("school-bus-api.onrender.com")) localStorage.removeItem("sbt_api");
    else if (saved) return saved.replace(/\/$/, "");
  } catch {
    /* ignore */
  }
  const fromQuery = new URLSearchParams(location.search).get("api");
  if (fromQuery) return fromQuery.replace(/\/$/, "");
  const host = location.hostname;
  if (host.endsWith("onrender.com")) return location.origin;
  if (host === "localhost" || host === "127.0.0.1") {
    if (STATIC_PORTS.has(location.port)) return "http://127.0.0.1:8000";
    return location.origin;
  }
  return LIVE_API;
}

function wsBase() {
  return apiBase().replace(/^http/, "ws");
}

let token = localStorage.getItem(TOKEN_KEY);
let user = readJson(USER_KEY, null);
let socket = null;
let map = null;
let markersLayer = null;
let routeLayer = null;
let pollTimer = null;
let selectedChild = 0;
let geoWatch = null;
let currentTab = "";

const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
const main = document.getElementById("main");
const tabs = document.getElementById("tabs");
const who = document.getElementById("who");
const whoMobile = document.getElementById("who-mobile");
const loginError = document.getElementById("login-error");
const pageTitle = document.getElementById("page-title");
const pageKicker = document.getElementById("page-kicker");

function isAdmin(role) {
  return role === "admin" || role === "customer_admin" || role === "product_admin";
}

function roleLabel(role) {
  if (role === "parent") return "Parent";
  if (role === "driver") return "Driver";
  return "School admin";
}

function initials(name) {
  return (name || "U")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function fmtTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
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

function stopGeo() {
  if (geoWatch != null && navigator.geolocation) {
    navigator.geolocation.clearWatch(geoWatch);
    geoWatch = null;
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
    }, 2500);
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
  if (typeof L === "undefined") {
    el.innerHTML = '<p class="muted" style="padding:16px">Map tiles unavailable. Live status still updates above.</p>';
    return;
  }
  if (!map) {
    map = L.map(el).setView(center, 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);
    routeLayer = L.layerGroup().addTo(map);
    markersLayer = L.layerGroup().addTo(map);
  }
  setTimeout(() => map && map.invalidateSize(), 60);
}

function setMapData({ bus, stop, stops, buses, onMapClick }) {
  const points = [];
  if (bus && bus.current_lat != null && bus.current_lng != null) points.push([bus.current_lat, bus.current_lng]);
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
    stops.forEach((s) => {
      L.circleMarker([s.lat, s.lng], {
        radius: 7,
        color: "#fff",
        weight: 2,
        fillColor: s.reached ? "#8a96a3" : "#1c4e7a",
        fillOpacity: 1,
      })
        .bindTooltip(`${s.sequence_number}. ${s.name}`)
        .addTo(markersLayer);
    });
  } else if (stop) {
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
  return (item.type || "alert").replaceAll("_", " ");
}

function setPage(title, kicker) {
  pageTitle.textContent = title;
  pageKicker.textContent = kicker;
}

function navItems() {
  if (user.role === "parent") {
    return [
      ["track", "Track"],
      ["alerts", "Alerts"],
      ["profile", "Profile"],
    ];
  }
  if (user.role === "driver") {
    return [
      ["trip", "Trip"],
      ["tools", "Tools"],
      ["profile", "Profile"],
    ];
  }
  return [
    ["fleet", "Fleet"],
    ["manage", "Manage"],
    ["alerts", "Alerts"],
    ["profile", "Profile"],
  ];
}

function renderNav(active) {
  currentTab = active;
  tabs.innerHTML = navItems()
    .map(
      ([id, label]) =>
        `<button data-tab="${id}" class="${id === active ? "active" : ""}" type="button">${label}</button>`,
    )
    .join("");
}

function resetView() {
  closeSocket();
  destroyMap();
  stopGeo();
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

function showLogin() {
  resetView();
  loginView.hidden = false;
  appView.hidden = true;
}

function showApp(tab) {
  loginView.hidden = true;
  appView.hidden = false;
  const label = `${user.name} · ${roleLabel(user.role)}`;
  who.textContent = label;
  whoMobile.textContent = label;
  const first = navItems()[0][0];
  openTab(tab || first);
}

function openTab(tab) {
  resetView();
  renderNav(tab);
  const loaders = {
    track: loadParentTrack,
    alerts: user.role === "parent" ? loadParentAlerts : loadAdminAlerts,
    profile: loadProfile,
    trip: loadDriverTrip,
    tools: loadDriverTools,
    fleet: loadAdminFleet,
    manage: loadAdminManage,
    routes: loadAdminRoutes,
    assignments: loadAdminAssignments,
    audit: loadAdminAudit,
  };
  const titles = {
    track: ["Your child’s ride", "Parent"],
    alerts: ["Alerts", user.role === "parent" ? "Parent" : "Operations"],
    profile: ["Profile", roleLabel(user.role)],
    trip: ["Today’s trip", "Driver"],
    tools: ["Driver tools", "Driver"],
    fleet: ["Fleet", "Operations"],
    manage: ["Manage", "Operations"],
    routes: ["Routes & stops", "Operations"],
    assignments: ["Buses & assignments", "Operations"],
    audit: ["Trip audit log", "Operations"],
  };
  const [title, kicker] = titles[tab] || ["Overview", "Console"];
  setPage(title, kicker);
  (loaders[tab] || loadProfile)();
}

tabs.addEventListener("click", (event) => {
  const btn = event.target.closest("button");
  if (btn) openTab(btn.dataset.tab);
});

document.getElementById("toggle-pass").addEventListener("click", () => {
  const input = document.getElementById("password");
  const hidden = input.type === "password";
  input.type = hidden ? "text" : "password";
  document.getElementById("toggle-pass").textContent = hidden ? "Hide" : "Show";
});

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
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
    main.innerHTML =
      '<div class="card empty">No alerts yet. Arrival warnings, delays, and school arrival will appear here.</div>';
    return;
  }
  main.innerHTML = `<div class="alert-list">${items
    .map((item) => {
      const klass = item.type === "emergency" ? "alert emergency" : "alert";
      return `<div class="${klass}"><strong>${escapeHtml(alertTitle(item))}</strong><div class="muted">${fmtTime(item.sent_at)}</div></div>`;
    })
    .join("")}</div>`;
}

async function loadParentTrack() {
  main.innerHTML = '<p class="muted">Loading your child’s bus…</p>';
  let children = [];
  try {
    children = await request("/api/parent/children");
  } catch (err) {
    main.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
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
                `<button class="chip${i === selectedChild ? " active" : ""}" data-child="${i}" type="button">${escapeHtml(c.student.name)}</button>`,
            )
            .join("")}</div>`
        : "";
    if (!student) {
      main.innerHTML = `${chips}<div class="card">No child linked yet. Ask your school admin to assign a pickup stop.</div>`;
      return;
    }
    const etaLine =
      eta && eta.eta_minutes != null && !bundle.school_arrived && !student.boarded
        ? `<div>~${Math.round(eta.eta_minutes)} min to ${escapeHtml(eta.target_name || stop?.name || "pickup")}</div>`
        : "";
    const schoolBanner = bundle.school_arrived
      ? `<div class="school-banner"><div class="card-label">School</div><strong>Arrived at school</strong><p class="muted">The bus has reached the school gate.</p></div>`
      : "";
    main.innerHTML = `
      ${chips}
      <div class="card status">
        <div class="dot ${status.tone}"></div>
        <div>
          <div class="muted">${escapeHtml(status.label)}</div>
          <strong>${escapeHtml(student.name)}</strong>
          ${etaLine}
          <div class="muted">Bus ${escapeHtml(bus?.bus_number || "—")} · Pickup ${escapeHtml(stop?.name || "Not set")}</div>
          <div class="muted">Updated ${fmtTime(bus && bus.last_updated_at)}</div>
        </div>
      </div>
      ${schoolBanner}
      <div class="card board-card">
        <div>
          <div class="card-label">Boarding</div>
          <div>${student.boarded ? `${escapeHtml(student.name)} is boarded` : "Confirm when your child is on the bus"}</div>
        </div>
        <button id="board-btn" class="${student.boarded ? "btn-secondary" : "btn-primary"}" type="button" style="width:auto;margin:0">
          ${student.boarded ? "Undo boarded" : "Mark as boarded"}
        </button>
      </div>
      <div id="map" class="map"></div>
    `;
    document.getElementById("board-btn").onclick = async () => {
      await request(`/api/parent/students/${student.id}/board`, {
        method: "POST",
        body: JSON.stringify({ boarded: !student.boarded }),
      });
      loadParentTrack();
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
        if (msg.bus) setMapData({ bus: msg.bus, stop, stops: bundle.route && bundle.route.stops });
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
    main.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

async function loadProfile() {
  const school = await request("/api/auth/school-contact").catch(() => null);
  const kids = user.role === "parent" ? await request("/api/parent/children").catch(() => []) : [];
  const mins = user.alert_minutes_before || 5;
  const schoolHtml = school
    ? `<div class="card"><div class="card-label">School contact</div><strong>${escapeHtml(school.name)}</strong>
        <div class="muted">${escapeHtml(school.phone || "—")}</div>
        <div class="muted">${escapeHtml(school.email || "—")}</div>
        <div class="muted">${escapeHtml(school.address || "—")}</div></div>`
    : "";
  const kidsHtml =
    user.role === "parent"
      ? `<div class="card"><div class="card-label">Children</div>${
          kids.length
            ? kids
                .map(
                  (c) =>
                    `<div class="row"><div><strong>${escapeHtml(c.student.name)}</strong><div class="muted">${escapeHtml(c.stop?.name || "No stop")}</div></div><div class="muted">${escapeHtml(c.bus?.bus_number || "")}</div></div>`,
                )
                .join("")
            : '<div class="empty">No children linked yet.</div>'
        }</div>`
      : "";
  const prefs =
    user.role === "parent"
      ? `<div class="card"><div class="card-label">Arrival alert timing</div>
          <p class="muted">Notify me when the bus is about this many minutes from the pickup stop.</p>
          <div class="chips">${[5, 10, 15]
            .map(
              (n) =>
                `<button class="chip${mins === n ? " active" : ""}" data-mins="${n}" type="button">${n} min</button>`,
            )
            .join("")}</div><p id="prefs-msg" class="ok"></p></div>`
      : `<div class="card"><div class="card-label">Your role</div><p class="muted">${
          user.role === "driver"
            ? "Share live location during a trip so parents can watch the bus."
            : "Watch the fleet, manage routes, assign drivers, and review alerts."
        }</p></div>`;
  main.innerHTML = `
    <div class="card hero">
      <div class="avatar">${escapeHtml(initials(user.name))}</div>
      <div><strong>${escapeHtml(user.name)}</strong><div class="muted">${roleLabel(user.role)} account</div></div>
    </div>
    <div class="card">
      <div class="card-label">Account</div>
      <div class="row"><span class="muted">Email</span><strong>${escapeHtml(user.email)}</strong></div>
      <div class="row"><span class="muted">Phone</span><strong>${escapeHtml(user.phone || "Not set")}</strong></div>
    </div>
    ${kidsHtml}${prefs}${schoolHtml}
  `;
  main.querySelectorAll("[data-mins]").forEach((btn) => {
    btn.onclick = async () => {
      user = await request("/api/auth/prefs", {
        method: "PUT",
        body: JSON.stringify({ alert_minutes_before: Number(btn.dataset.mins) }),
      });
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      document.getElementById("prefs-msg").textContent = `Alerts set to ${btn.dataset.mins} minutes before arrival.`;
      loadProfile();
    };
  });
}

async function sendPoint(busId, lat, lng) {
  return request("/api/location/latest", {
    method: "POST",
    body: JSON.stringify({
      bus_id: busId,
      lat,
      lng,
      speed: null,
      recorded_at: new Date().toISOString(),
    }),
  });
}

function startBrowserGps(busId, onFix) {
  stopGeo();
  if (!navigator.geolocation) return;
  geoWatch = navigator.geolocation.watchPosition(
    async (pos) => {
      try {
        const res = await sendPoint(busId, pos.coords.latitude, pos.coords.longitude);
        if (res.bus) onFix(res.bus);
      } catch {
        /* ignore */
      }
    },
    () => undefined,
    { enableHighAccuracy: true, maximumAge: 3000 },
  );
}

async function loadDriverTrip() {
  main.innerHTML = '<p class="muted">Loading your bus…</p>';
  let payload;
  try {
    payload = await request("/api/buses/mine");
  } catch (err) {
    main.innerHTML = `<div class="card"><strong>No bus assigned</strong><p class="muted">${escapeHtml(err.message)}</p></div>`;
    return;
  }
  const paint = (current, route) => {
    destroyMap();
    const status = toneOf(current);
    const next = (route && route.stops || []).find((s) => !s.reached);
    const stops = [...((route && route.stops) || [])].sort((a, b) => a.sequence_number - b.sequence_number);
    main.innerHTML = `
      <div class="card status">
        <div class="dot ${status.tone}"></div>
        <div>
          <div class="muted">${current.trip_active ? "Sharing live with parents" : "Ready when you are"}</div>
          <strong>${escapeHtml(current.bus_number)}</strong>
          <div class="muted">Route: ${escapeHtml((route && route.name) || "Unassigned")}</div>
          <div class="muted">Next stop: ${escapeHtml(next ? next.name : "—")}</div>
        </div>
      </div>
      <p id="trip-msg" class="ok"></p>
      <div class="btn-row">
        <button id="trip-btn" class="${current.trip_active ? "btn-danger" : "btn-primary"}" type="button">${current.trip_active ? "End trip" : "Start trip"}</button>
        <button id="stop-btn" class="btn-secondary" type="button">Mark stop reached</button>
      </div>
      <div class="btn-row">
        <button id="delay-btn" class="btn-ghost" type="button">Delay broadcast</button>
        <button id="emg-btn" class="btn-ghost" type="button">Emergency broadcast</button>
      </div>
      <div class="card"><div class="card-label">Stops</div>${
        stops.length
          ? stops
              .map(
                (s) =>
                  `<div class="row"><div>${s.sequence_number}. ${escapeHtml(s.name)}</div><div class="muted">${s.reached ? "Reached" : "Upcoming"}</div></div>`,
              )
              .join("")
          : '<div class="empty">No stops on this route.</div>'
      }</div>
      <p class="muted">On the web, location is sent from this browser (allow GPS) or by tapping the map.</p>
      <div id="map" class="map"></div>
    `;
    const msg = document.getElementById("trip-msg");
    document.getElementById("trip-btn").onclick = async () => {
      const action = current.trip_active ? "end-trip" : "start-trip";
      const res = await request(`/api/buses/${current.id}/${action}`, { method: "POST" });
      if (action === "end-trip") stopGeo();
      else startBrowserGps(current.id, (bus) => paint(bus, route));
      paint(res.bus || current, route);
      msg.textContent = action === "start-trip" ? "Trip started — parents can see live location." : "Trip ended.";
    };
    document.getElementById("stop-btn").onclick = async () => {
      const res = await request(`/api/buses/${current.id}/mark-stop-reached`, { method: "POST" });
      paint(res.bus || current, res.route || route);
      msg.textContent = "Stop marked as reached.";
    };
    document.getElementById("delay-btn").onclick = async () => {
      const res = await request(`/api/buses/${current.id}/broadcast`, {
        method: "POST",
        body: JSON.stringify({ type: "delay", message: "Bus is running late." }),
      });
      msg.textContent = `Delay sent — notified ${res.notified} parent(s).`;
    };
    document.getElementById("emg-btn").onclick = async () => {
      const res = await request(`/api/buses/${current.id}/broadcast`, {
        method: "POST",
        body: JSON.stringify({ type: "emergency", message: "Emergency alert from the driver." }),
      });
      msg.textContent = `Emergency sent — notified ${res.notified} parent(s).`;
    };
    setMapData({
      bus: current,
      stops,
      onMapClick: async (lat, lng) => {
        const res = await sendPoint(current.id, lat, lng);
        if (res.bus) paint(res.bus, route);
      },
    });
    if (current.trip_active) startBrowserGps(current.id, (bus) => setMapData({ bus, stops }));
  };
  paint(payload.bus, payload.route);
}

async function loadDriverTools() {
  main.innerHTML = `
    <div class="card">
      <div class="card-label">Simulate GPS</div>
      <p class="muted">Use this when you are not on the road. Open Trip, start the trip, then tap the map (or allow browser GPS) to move the bus along the route.</p>
      <button id="goto-trip" class="btn-primary" type="button" style="width:auto">Go to trip map</button>
    </div>
  `;
  document.getElementById("goto-trip").onclick = () => openTab("trip");
}

async function loadAdminFleet() {
  main.innerHTML = '<p class="muted">Loading fleet…</p>';
  let buses = [];
  try {
    buses = await request("/api/buses");
  } catch (err) {
    main.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    return;
  }
  const rowsHtml = (list) =>
    list
      .map((bus) => {
        const status = toneOf(bus);
        return `<div class="row"><div><strong>${escapeHtml(bus.bus_number)}</strong><div class="muted">${escapeHtml(status.label)}</div></div><div class="dot ${status.tone}"></div></div>`;
      })
      .join("") || '<div class="empty">No buses in the fleet yet.</div>';
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
    main.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
}

async function loadAdminManage() {
  main.innerHTML = `
    <p class="muted">People, buses, routes, and who drives which bus.</p>
    <div class="manage-grid">
      <button class="manage-tile" data-go="routes" type="button"><h3>Routes & stops</h3><p class="muted">Review and add routes with stop coordinates.</p></button>
      <button class="manage-tile" data-go="assignments" type="button"><h3>Buses & assignments</h3><p class="muted">Add buses and link a driver and route.</p></button>
      <button class="manage-tile" data-go="audit" type="button"><h3>Trip audit log</h3><p class="muted">Trip starts, stop reaches, boarding, and broadcasts.</p></button>
    </div>
  `;
  main.querySelectorAll("[data-go]").forEach((btn) => {
    btn.onclick = () => openTab(btn.dataset.go);
  });
}

async function loadAdminRoutes() {
  main.innerHTML = '<p class="muted">Loading routes…</p>';
  let routes = [];
  try {
    routes = await request("/api/admin/routes");
  } catch (err) {
    main.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
    return;
  }
  main.innerHTML = `
    <button class="btn-ghost" data-back type="button">← Manage</button>
    <div class="card">
      <div class="card-label">Add route</div>
      <label>Name</label>
      <input id="route-name" placeholder="Morning Route B" />
      <label>Stops (one per line: Name, lat, lng)</label>
      <textarea id="route-stops" rows="5" placeholder="Oak Street, 12.9716, 77.5946"></textarea>
      <button id="save-route" class="btn-primary" type="button">Create route</button>
      <p id="route-msg" class="ok"></p>
    </div>
    ${routes
      .map(
        (r) =>
          `<div class="card"><strong>${escapeHtml(r.name)}</strong><div class="muted">${escapeHtml(r.schedule || "morning")}</div>${(r.stops || [])
            .map((s) => `<div class="row"><div>${s.sequence_number}. ${escapeHtml(s.name)}</div><div class="muted">${s.lat.toFixed(4)}, ${s.lng.toFixed(4)}</div></div>`)
            .join("")}</div>`,
      )
      .join("") || '<div class="card empty">No routes yet.</div>'}
  `;
  main.querySelector("[data-back]").onclick = () => openTab("manage");
  document.getElementById("save-route").onclick = async () => {
    const name = document.getElementById("route-name").value.trim();
    const lines = document.getElementById("route-stops").value.split("\n").map((l) => l.trim()).filter(Boolean);
    const stops = lines.map((line, i) => {
      const [stopName, lat, lng] = line.split(",").map((p) => p.trim());
      return {
        stop_id: crypto.randomUUID(),
        name: stopName,
        lat: Number(lat),
        lng: Number(lng),
        sequence_number: i + 1,
        reached: false,
      };
    });
    await request("/api/admin/routes", { method: "POST", body: JSON.stringify({ name, stops, schedule: "morning" }) });
    document.getElementById("route-msg").textContent = "Route created.";
    loadAdminRoutes();
  };
}

async function loadAdminAssignments() {
  main.innerHTML = '<p class="muted">Loading assignments…</p>';
  const [buses, drivers, routes] = await Promise.all([
    request("/api/buses"),
    request("/api/admin/drivers"),
    request("/api/admin/routes"),
  ]);
  const driverName = (id) => drivers.find((d) => d.id === id)?.name || "Unassigned";
  const routeName = (id) => routes.find((r) => r.id === id)?.name || "Unassigned";
  main.innerHTML = `
    <button class="btn-ghost" data-back type="button">← Manage</button>
    <div class="card">
      <div class="card-label">Add bus</div>
      <div class="password-row">
        <input id="bus-number" placeholder="BUS-102" />
        <button id="add-bus" class="btn-primary" type="button" style="width:auto;margin:0">Add</button>
      </div>
      <p id="asg-msg" class="ok"></p>
    </div>
    ${buses
      .map((bus) => {
        const dOpts = drivers
          .map((d) => `<button class="chip${bus.driver_id === d.id ? " active" : ""}" data-bus="${bus.id}" data-driver="${d.id}" type="button">${escapeHtml(d.name)}</button>`)
          .join("");
        const rOpts = routes
          .map((r) => `<button class="chip${bus.route_id === r.id ? " active" : ""}" data-bus="${bus.id}" data-route="${r.id}" type="button">${escapeHtml(r.name)}</button>`)
          .join("");
        return `<div class="card"><strong>${escapeHtml(bus.bus_number)}</strong>
          <div class="muted">Driver: ${escapeHtml(driverName(bus.driver_id))} · Route: ${escapeHtml(routeName(bus.route_id))}</div>
          <div class="card-label" style="margin-top:12px">Set driver</div><div class="chips">${dOpts || '<span class="muted">No drivers</span>'}</div>
          <div class="card-label" style="margin-top:12px">Set route</div><div class="chips">${rOpts || '<span class="muted">No routes</span>'}</div></div>`;
      })
      .join("")}
  `;
  main.querySelector("[data-back]").onclick = () => openTab("manage");
  document.getElementById("add-bus").onclick = async () => {
    const bus_number = document.getElementById("bus-number").value.trim();
    if (!bus_number) return;
    await request("/api/admin/buses", { method: "POST", body: JSON.stringify({ bus_number }) });
    loadAdminAssignments();
  };
  main.querySelectorAll("[data-driver]").forEach((btn) => {
    btn.onclick = async () => {
      const bus = buses.find((b) => b.id === btn.dataset.bus);
      await request(`/api/admin/buses/${bus.id}/assign`, {
        method: "PUT",
        body: JSON.stringify({ driver_id: btn.dataset.driver, route_id: bus.route_id || null }),
      });
      loadAdminAssignments();
    };
  });
  main.querySelectorAll("[data-route]").forEach((btn) => {
    btn.onclick = async () => {
      const bus = buses.find((b) => b.id === btn.dataset.bus);
      await request(`/api/admin/buses/${bus.id}/assign`, {
        method: "PUT",
        body: JSON.stringify({ driver_id: bus.driver_id || null, route_id: btn.dataset.route }),
      });
      loadAdminAssignments();
    };
  });
}

async function loadAdminAudit() {
  main.innerHTML = '<p class="muted">Loading audit log…</p>';
  const rows = await request("/api/admin/audit").catch(() => []);
  main.innerHTML = `
    <button class="btn-ghost" data-back type="button">← Manage</button>
    ${
      rows.length
        ? rows
            .map(
              (r) =>
                `<div class="alert"><strong>${escapeHtml(r.action || "event")}</strong><div class="muted">${escapeHtml(r.actor_role || "")} · ${fmtTime(r.created_at)}</div></div>`,
            )
            .join("")
        : '<div class="card empty">No audit events yet.</div>'
    }
  `;
  main.querySelector("[data-back]").onclick = () => openTab("manage");
}

async function boot() {
  if (token && user) {
    try {
      user = await request("/api/auth/me");
      showApp();
      return;
    } catch {
      token = null;
      user = null;
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  }
  showLogin();
}

boot();
