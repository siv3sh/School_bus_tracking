import Constants from "expo-constants";

/** Set your machine LAN IP so a physical device can reach FastAPI. */
const FALLBACK_API = "http://127.0.0.1:8000";

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;

export const API_URL = (extra?.apiUrl || FALLBACK_API).replace(/\/$/, "");
export const WS_URL = API_URL.replace(/^http/, "ws");

export const PENDING_POINT_KEY = "latest_pending_point";
export const LOCATION_TASK = "SCHOOL_BUS_BACKGROUND_LOCATION";
