import math


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two WGS84 points in meters."""
    r = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def eta_minutes(distance_m: float, speed_mps: float | None, fallback_kmh: float) -> float:
    """ETA in minutes from distance and speed (m/s). Falls back to ~fallback_kmh if speed missing/low."""
    speed = speed_mps if speed_mps and speed_mps > 0.5 else (fallback_kmh * 1000.0 / 3600.0)
    if speed <= 0:
        return float("inf")
    return (distance_m / speed) / 60.0
