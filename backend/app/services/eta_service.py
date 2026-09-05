import logging
from typing import Optional

import requests

from app.config import settings
from app.services.geo_utils import eta_minutes, haversine_meters

logger = logging.getLogger(__name__)


def estimate_eta_minutes(
    lat1: float,
    lng1: float,
    lat2: float,
    lng2: float,
    speed_mps: Optional[float] = None,
    *,
    use_road: bool = True,
) -> dict:
    """
    ETA between two points.
    Tries free OSRM road duration first; falls back to haversine + speed/25kmh.
    """
    distance_m = haversine_meters(lat1, lng1, lat2, lng2)
    straight_min = eta_minutes(distance_m, speed_mps, settings.fallback_speed_kmh)
    result = {
        "distance_m": round(distance_m, 1),
        "eta_minutes": round(straight_min, 1) if straight_min != float("inf") else None,
        "eta_source": "haversine",
    }

    if not use_road or not settings.use_osrm:
        return result

    try:
        url = (
            f"{settings.osrm_base_url.rstrip('/')}/route/v1/driving/"
            f"{lng1},{lat1};{lng2},{lat2}?overview=false"
        )
        resp = requests.get(url, timeout=settings.osrm_timeout_seconds)
        resp.raise_for_status()
        data = resp.json()
        routes = data.get("routes") or []
        if routes:
            duration_s = float(routes[0].get("duration") or 0)
            road_dist = float(routes[0].get("distance") or distance_m)
            result["distance_m"] = round(road_dist, 1)
            result["eta_minutes"] = round(duration_s / 60.0, 1)
            result["eta_source"] = "osrm"
    except Exception as exc:
        logger.debug("OSRM unavailable, using haversine: %s", exc)

    return result
