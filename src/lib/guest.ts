import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { GUEST_COOKIE } from "@/lib/constants";

export { GUEST_COOKIE };

export async function getOrCreateGuestId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;
  if (existing) return existing;

  const id = randomUUID();
  store.set(GUEST_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}
