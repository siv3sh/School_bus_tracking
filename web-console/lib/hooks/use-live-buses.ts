"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { issueWsTicket, listBuses } from "@/lib/api/admin";
import type { BusPublic } from "@/lib/api/types";

function wsBase(): string {
  const fromEnv = process.env.NEXT_PUBLIC_FASTAPI_WS_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}`;
  }
  return "ws://127.0.0.1:8000";
}

export function useLiveBuses() {
  const queryClient = useQueryClient();
  const [socketLive, setSocketLive] = useState(false);
  const query = useQuery({
    queryKey: ["school", "buses"],
    queryFn: listBuses,
    refetchInterval: socketLive ? false : 8000,
  });

  useEffect(() => {
    let stopped = false;
    let socket: WebSocket | null = null;
    let refreshTimer = 0;
    let reconnectTimer = 0;

    const connect = async () => {
      try {
        const ticket = await issueWsTicket();
        if (stopped) return;
        const url = `${wsBase()}/ws/admin?token=${encodeURIComponent(ticket.access_token)}`;
        socket = new WebSocket(url);
        socket.onopen = () => setSocketLive(true);
        socket.onmessage = (event) => {
          let payload: { bus?: BusPublic } = {};
          try {
            payload = JSON.parse(event.data) as { bus?: BusPublic };
          } catch {
            return;
          }
          const incoming = payload.bus;
          if (!incoming?.id) return;
          queryClient.setQueryData<BusPublic[]>(["school", "buses"], (current) => {
            if (!current) return current;
            const index = current.findIndex((bus) => bus.id === incoming.id);
            if (index === -1) return current;
            const next = current.slice();
            next[index] = { ...current[index], ...incoming };
            return next;
          });
        };
        socket.onclose = () => {
          setSocketLive(false);
          if (!stopped) reconnectTimer = window.setTimeout(() => void connect(), 3000);
        };
        socket.onerror = () => socket?.close();
        const refreshMs = Math.max((ticket.expires_in - 20) * 1000, 20_000);
        refreshTimer = window.setTimeout(() => socket?.close(), refreshMs);
      } catch {
        setSocketLive(false);
        if (!stopped) reconnectTimer = window.setTimeout(() => void connect(), 5000);
      }
    };

    void connect();
    return () => {
      stopped = true;
      window.clearTimeout(refreshTimer);
      window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [queryClient]);

  return { ...query, socketLive };
}
