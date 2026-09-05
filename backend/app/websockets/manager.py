from typing import Any

from fastapi import WebSocket


class ConnectionManager:
    """In-memory bus_id -> connected WebSocket list (Phase 1 — no Redis)."""

    def __init__(self) -> None:
        self._trackers: dict[str, list[WebSocket]] = {}
        self._drivers: dict[str, list[WebSocket]] = {}
        self._admins: list[WebSocket] = []

    async def connect_tracker(self, bus_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._trackers.setdefault(bus_id, []).append(websocket)

    def disconnect_tracker(self, bus_id: str, websocket: WebSocket) -> None:
        conns = self._trackers.get(bus_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self._trackers.pop(bus_id, None)

    async def connect_driver(self, bus_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._drivers.setdefault(bus_id, []).append(websocket)

    def disconnect_driver(self, bus_id: str, websocket: WebSocket) -> None:
        conns = self._drivers.get(bus_id, [])
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self._drivers.pop(bus_id, None)

    async def connect_admin(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._admins.append(websocket)

    def disconnect_admin(self, websocket: WebSocket) -> None:
        if websocket in self._admins:
            self._admins.remove(websocket)

    async def broadcast_bus(self, bus_id: str, message: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in self._trackers.get(bus_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_tracker(bus_id, ws)

        dead_admins: list[WebSocket] = []
        for ws in self._admins:
            try:
                await ws.send_json({"type": "bus_update", "bus_id": bus_id, **message})
            except Exception:
                dead_admins.append(ws)
        for ws in dead_admins:
            self.disconnect_admin(ws)

    async def notify_admins(self, message: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in self._admins:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect_admin(ws)


manager = ConnectionManager()
