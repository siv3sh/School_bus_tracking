import Constants from "expo-constants";

/** Dev client: LAN IP in app.json. Preview APK: EXPO_PUBLIC_API_URL (Render). */
const FALLBACK_API = "http://127.0.0.1:8000";

const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;

const fromEnv = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
export const API_URL = (fromEnv || extra?.apiUrl || FALLBACK_API).replace(/\/$/, "");
export const WS_URL = API_URL.replace(/^http/, "ws");

export const PENDING_POINT_KEY = "latest_pending_point";
export const LOCATION_TASK = "SCHOOL_BUS_BACKGROUND_LOCATION";
