import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GUEST_COOKIE } from "@/lib/constants";

export function proxy(request: NextRequest) {
  if (request.cookies.has(GUEST_COOKIE)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set(GUEST_COOKIE, crypto.randomUUID(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
