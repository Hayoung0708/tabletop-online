import { NextResponse } from "next/server";

/** 매번 새로 응답해야 슬립 방지 핑이 캐시에 걸리지 않는다. */
export const dynamic = "force-dynamic";

/**
 * 서버가 깨어 있는지 확인하는 용도의 가벼운 응답. 슬립 방지 핑이 10분마다
 * 두드리는 곳이라 DB는 건드리지 않는다 — 여기서 DB를 치면 그만큼 Neon
 * 컴퓨트 시간을 계속 태우게 된다.
 * @returns 상태 응답
 */
export const GET = async (): Promise<NextResponse> => {
  return NextResponse.json({ status: "ok" });
};
