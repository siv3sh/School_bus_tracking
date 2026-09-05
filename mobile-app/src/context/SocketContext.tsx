import React, { createContext, useContext, useEffect, useMemo, useRef } from "react";

import { BusSocket } from "../services/socketService";
import type { Bus } from "../types";
import { useAuth } from "./AuthContext";

type SocketContextValue = {
  subscribeBus: (
    busId: string,
    onUpdate: (bus: Bus, meta?: { type?: string }) => void,
  ) => () => void;
  subscribeAdmin: (onUpdate: (payload: unknown) => void) => () => void;
  openDriverSocket: (busId: string) => BusSocket;
};

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const socketsRef = useRef<Map<string, BusSocket>>(new Map());

  useEffect(() => {
    return () => {
      socketsRef.current.forEach((s) => s.close());
      socketsRef.current.clear();
    };
  }, [token]);

  const value = useMemo<SocketContextValue>(
    () => ({
      subscribeBus: (busId, onUpdate) => {
        const key = `track:${busId}`;
        socketsRef.current.get(key)?.close();
        const sock = new BusSocket(`/ws/track/${busId}`, (data) => {
          const msg = data as { bus?: Bus; type?: string };
          if (msg.bus) onUpdate(msg.bus, { type: msg.type });
        });
        sock.connect();
        socketsRef.current.set(key, sock);
        return () => {
          sock.close();
          socketsRef.current.delete(key);
        };
      },
      subscribeAdmin: (onUpdate) => {
        const key = "admin";
        socketsRef.current.get(key)?.close();
        const sock = new BusSocket("/ws/admin", onUpdate);
        sock.connect();
        socketsRef.current.set(key, sock);
        return () => {
          sock.close();
          socketsRef.current.delete(key);
        };
      },
      openDriverSocket: (busId) => {
        const key = `driver:${busId}`;
        socketsRef.current.get(key)?.close();
        const sock = new BusSocket(`/ws/driver/${busId}`, () => undefined);
        sock.connect();
        socketsRef.current.set(key, sock);
        return sock;
      },
    }),
    [token],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSockets() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error("useSockets must be used within SocketProvider");
  return ctx;
}
