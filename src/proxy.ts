import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GUEST_COOKIE } from "@/constants/app";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * 게스트 쿠키가 없는 첫 방문자에게 익명 식별자를 발급한다.
 * @param request - 들어온 요청
 * @returns 다음 단계로 넘어가는 응답
 */
export const proxy = (request: NextRequest): NextResponse => {
  if (request.cookies.has(GUEST_COOKIE)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set(GUEST_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return response;
};

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
