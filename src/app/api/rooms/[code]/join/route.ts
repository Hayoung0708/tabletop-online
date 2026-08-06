import { NextResponse } from "next/server";
import { z } from "zod";
import { getOrCreateGuestId } from "@/lib/guest";
import { prisma } from "@/lib/prisma";

const nicknameSchema = z
  .string()
  .trim()
  .min(2, "닉네임은 2자 이상이어야 합니다.")
  .max(16, "닉네임은 16자 이하여야 합니다.")
  .regex(
    /^[a-zA-Z0-9가-힣_-]+$/,
    "한글, 영문, 숫자, -, _ 만 사용할 수 있습니다."
  );

export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const guestId = await getOrCreateGuestId();
    const { code } = await params;

    const body = await request.json().catch(() => null);
    const parsed = nicknameSchema.safeParse(body?.nickname);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "잘못된 닉네임입니다." },
        { status: 400 }
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

    // room.players.length collides once anyone but the last-seated player has
    // left (e.g. seats 0,1 -> 0 leaves -> next join recomputes length as 1,
    // which player 1 already holds). Pick a seat past the highest taken one
    // instead, so it's always free regardless of who left.
    const nextSeat =
      room.players.reduce((max, p) => Math.max(max, p.seat), -1) + 1;

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
}
