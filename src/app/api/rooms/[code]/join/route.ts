import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateGuestId } from "@/server/guestAuth";
import { prisma } from "@/lib/prisma";

const MIN_NICKNAME_LENGTH = 2;
const MAX_NICKNAME_LENGTH = 16;

const nicknameSchema = z
  .string()
  .trim()
  .min(MIN_NICKNAME_LENGTH, "닉네임은 2자 이상이어야 합니다.")
  .max(MAX_NICKNAME_LENGTH, "닉네임은 16자 이하여야 합니다.")
  .regex(/^[a-zA-Z0-9가-힣_-]+$/, "한글, 영문, 숫자, -, _ 만 사용할 수 있습니다.");

export interface JoinRouteContext {
  params: Promise<{ code: string }>;
}

/**
 * 방에 참가한다. 이미 참가한 적 있으면 그대로 성공을 돌려주고, 정원이 찼거나
 * 이미 시작된 방이면 거부한다.
 * @param request - 닉네임이 담긴 요청
 * @param context - 라우트 파라미터 (방 코드)
 * @param context.params
 * @returns 참가 결과 응답
 */
export const POST = async (
  request: Request,
  { params }: JoinRouteContext,
): Promise<NextResponse> => {
  try {
    const guestId = await getOrCreateGuestId();
    const { code } = await params;

    const body = await request.json().catch(() => null);
    const parsed = nicknameSchema.safeParse(body?.nickname);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 닉네임입니다." },
        { status: 400 },
      );
    }
    const nickname = parsed.data;

    const room = await prisma.room.findUnique({
      where: { code: code.toUpperCase() },
      include: { players: true },
    });

    if (!room) {
      return NextResponse.json({ error: "존재하지 않는 방입니다." }, { status: 404 });
    }

    await prisma.player.upsert({
      where: { id: guestId },
      update: { nickname },
      create: { id: guestId, nickname },
    });

    const alreadyJoined = room.players.some((p) => p.playerId === guestId);
    if (alreadyJoined) {
      return NextResponse.json({ code: room.code });
    }

    if (room.status !== "WAITING") {
      return NextResponse.json({ error: "이미 시작된 게임입니다." }, { status: 409 });
    }

    if (room.players.length >= room.maxPlayers) {
      return NextResponse.json({ error: "방이 가득 찼습니다." }, { status: 409 });
    }

    // room.players.length는 마지막에 앉은 사람이 아닌 다른 사람이 나가면 남은
    // 좌석과 충돌한다 (좌석 0,1에서 0이 나가면 길이가 1로 줄어 1번 좌석과 겹침).
    // 항상 가장 큰 좌석번호+1을 써야 누가 나갔든 항상 빈 자리를 잡는다.
    const nextSeat = room.players.reduce((max, p) => Math.max(max, p.seat), -1) + 1;

    await prisma.roomPlayer.create({
      data: {
        roomId: room.id,
        playerId: guestId,
        seat: nextSeat,
      },
    });

    return NextResponse.json({ code: room.code });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "참가할 수 없습니다." }, { status: 500 });
  }
};
