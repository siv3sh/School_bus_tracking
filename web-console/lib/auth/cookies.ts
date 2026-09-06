import { cookies } from "next/headers";

import { ACTING_CUSTOMER_COOKIE, TOKEN_COOKIE } from "@/lib/auth/cookie-names";

export { ACTING_CUSTOMER_COOKIE, TOKEN_COOKIE };

const WEEK_SECONDS = 60 * 60 * 24 * 7;

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function getTokenCookie(): Promise<string | undefined> {
  return (await cookies()).get(TOKEN_COOKIE)?.value;
}

export async function getActingCustomerId(): Promise<string | undefined> {
  return (await cookies()).get(ACTING_CUSTOMER_COOKIE)?.value;
}

export async function setTokenCookie(token: string): Promise<void> {
  (await cookies()).set(TOKEN_COOKIE, token, { ...cookieBase(), maxAge: WEEK_SECONDS });
}

export async function setActingCustomerCookie(customerId: string): Promise<void> {
  (await cookies()).set(ACTING_CUSTOMER_COOKIE, customerId, { ...cookieBase(), maxAge: WEEK_SECONDS });
}

export async function clearTokenCookie(): Promise<void> {
  (await cookies()).delete(TOKEN_COOKIE);
}

export async function clearActingCustomerCookie(): Promise<void> {
  (await cookies()).delete(ACTING_CUSTOMER_COOKIE);
}
