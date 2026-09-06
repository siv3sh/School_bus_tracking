/** Client-side geo helpers for stop progress (mirrors backend haversine). */

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lng2 - lng1);
  const a =
    Math.sin(dPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}

export function etaMinutesFromDistance(
  distanceM: number,
  speedMps: number | null | undefined,
  fallbackKmh = 25,
): number | null {
  if (!Number.isFinite(distanceM) || distanceM < 0) return null;
  const speed =
    speedMps != null && speedMps > 0.5 ? speedMps : (fallbackKmh * 1000) / 3600;
  if (speed <= 0) return null;
  return distanceM / speed / 60;
}

export function formatDistanceM(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function formatEtaMinutes(minutes: number | null): string {
  if (minutes == null || !Number.isFinite(minutes)) return "—";
  if (minutes < 1) return "< 1 min";
  return `~${Math.round(minutes)} min`;
}
