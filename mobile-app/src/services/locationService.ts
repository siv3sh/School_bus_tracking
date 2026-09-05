import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { LOCATION_TASK, PENDING_POINT_KEY } from "../config/env";
import type { PendingPoint } from "../types";
import { api } from "./api";
import type { BusSocket } from "./socketService";

export async function savePendingPoint(point: PendingPoint): Promise<void> {
  await AsyncStorage.setItem(PENDING_POINT_KEY, JSON.stringify(point));
}

export async function loadPendingPoint(): Promise<PendingPoint | null> {
  const raw = await AsyncStorage.getItem(PENDING_POINT_KEY);
  return raw ? (JSON.parse(raw) as PendingPoint) : null;
}

export async function clearPendingPoint(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_POINT_KEY);
}

export async function requestLocationPermissions(): Promise<{ ok: boolean; message?: string }> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") {
    return {
      ok: false,
      message:
        "Location permission is required to track the school bus. Enable it in Settings to continue.",
    };
  }
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") {
    return {
      ok: false,
      message:
        "Background location is required so tracking continues when the screen is locked. Enable \"Always\" location for this app.",
    };
  }
  return { ok: true };
}

type PublishDeps = {
  socket: BusSocket | null;
  isOnline: boolean;
};

let publishDeps: PublishDeps = { socket: null, isOnline: true };

export function setLocationPublishDeps(deps: Partial<PublishDeps>) {
  publishDeps = { ...publishDeps, ...deps };
}

export async function publishPoint(point: PendingPoint): Promise<void> {
  await savePendingPoint(point);
  if (!publishDeps.isOnline) return;

  const sentWs = publishDeps.socket?.sendLocation(point) ?? false;
  // REST fallback alongside WS for reliability
  try {
    await api.postLatestLocation(point);
  } catch {
    if (!sentWs) {
      // stay pending for reconnect flush
    }
  }
}

export async function flushPendingIfOnline(isOnline: boolean, socket: BusSocket | null): Promise<void> {
  if (!isOnline) return;
  const pending = await loadPendingPoint();
  if (!pending) return;
  setLocationPublishDeps({ isOnline, socket });
  await publishPoint(pending);
}

function toPoint(busId: string, loc: Location.LocationObject): PendingPoint {
  return {
    bus_id: busId,
    lat: loc.coords.latitude,
    lng: loc.coords.longitude,
    speed: loc.coords.speed != null && loc.coords.speed >= 0 ? loc.coords.speed : null,
    recorded_at: new Date(loc.timestamp).toISOString(),
  };
}

// Background task must be defined in global scope.
// Note: Expo Go does not support background location — use an EAS development build on a real device.
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }) => {
  if (error) return;
  const locations = (data as { locations?: Location.LocationObject[] })?.locations;
  if (!locations?.length) return;
  const pending = await loadPendingPoint();
  const busId = pending?.bus_id;
  if (!busId) return;
  const point = toPoint(busId, locations[locations.length - 1]);
  await publishPoint(point);
});

let watchSub: Location.LocationSubscription | null = null;

export async function startTracking(busId: string): Promise<void> {
  // Seed pending with bus_id so background task knows which bus
  await savePendingPoint({
    bus_id: busId,
    lat: 0,
    lng: 0,
    speed: null,
    recorded_at: new Date().toISOString(),
  });

  watchSub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 3000,
      distanceInterval: 10,
    },
    async (loc) => {
      await publishPoint(toPoint(busId, loc));
    },
  );

  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (!started) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
      distanceInterval: 15,
      deferredUpdatesInterval: 5000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: "School bus trip active",
        notificationBody: "Sharing live bus location with parents",
      },
    });
  }
}

export async function stopTracking(): Promise<void> {
  watchSub?.remove();
  watchSub = null;
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
  await clearPendingPoint();
}
