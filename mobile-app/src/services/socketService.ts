import type { PendingPoint } from "../types";
import { getAuthToken } from "./api";
import { WS_URL } from "../config/env";

type MessageHandler = (data: unknown) => void;

export class BusSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private onMessage: MessageHandler;
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(path: string, onMessage: MessageHandler) {
    const token = getAuthToken();
    this.url = `${WS_URL}${path}?token=${encodeURIComponent(token || "")}`;
    this.onMessage = onMessage;
  }

  connect() {
    this.shouldReconnect = true;
    this.ws = new WebSocket(this.url);
    this.ws.onmessage = (event) => {
      try {
        this.onMessage(JSON.parse(String(event.data)));
      } catch {
        // ignore malformed
      }
    };
    this.ws.onclose = () => {
      if (this.shouldReconnect) {
        this.reconnectTimer = setTimeout(() => this.connect(), 2000);
      }
    };
  }

  sendLocation(point: PendingPoint) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          lat: point.lat,
          lng: point.lng,
          speed: point.speed,
          recorded_at: point.recorded_at,
        }),
      );
      return true;
    }
    return false;
  }

  sendPing() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "ping" }));
    }
  }

  close() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
  }

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
