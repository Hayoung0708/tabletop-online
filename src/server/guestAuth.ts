import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { GUEST_COOKIE } from "@/constants/app";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * 요청에 게스트 쿠키가 있으면 그 값을 쓰고, 없으면 새로 발급해 저장한다.
 * @returns 게스트 식별자
 */
export const getOrCreateGuestId = async (): Promise<string> => {
  const store = await cookies();
  const existing = store.get(GUEST_COOKIE)?.value;
  if (existing) return existing;

  const id = randomUUID();
  store.set(GUEST_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return id;
};
