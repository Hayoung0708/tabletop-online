import { NextResponse } from "next/server";
import { getOrCreateGuestId } from "@/lib/guest";
import { prisma } from "@/lib/prisma";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function GET() {
  const rooms = await prisma.room.findMany({
    where: { status: "WAITING", isPrivate: false, players: { some: {} } },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      players: { include: { player: { select: { nickname: true } } } },
    },
  });

  return NextResponse.json({
    rooms: rooms.map((r) => ({
      code: r.code,
      name: r.name,
      gameType: r.gameType,
      maxPlayers: r.maxPlayers,
      playerCount: r.players.length,
      nicknames: r.players.map((p) => p.player.nickname),
      createdAt: r.createdAt,
    })),
  });
}

const GAME_TYPES = ["YATZY"];

export async function POST(request: Request) {
  const guestId = await getOrCreateGuestId();
  const body = await request.json().catch(() => ({}));

  const maxPlayers = Math.min(6, Math.max(2, Number(body?.maxPlayers) || 6));
  const gameType = GAME_TYPES.includes(body?.gameType) ? body.gameType : "YATZY";
  const isPrivate = Boolean(body?.isPrivate);
  const name = String(body?.name ?? "").trim().slice(0, 20) || "야찌 한 판";

  let code = generateRoomCode();
  for (let attempts = 0; attempts < 5; attempts++) {
    const clash = await prisma.room.findUnique({ where: { code } });
    if (!clash) break;
    code = generateRoomCode();
  }

  const room = await prisma.room.create({
    data: { code, name, gameType, isPrivate, hostId: guestId, maxPlayers },
  });

  return NextResponse.json({ code: room.code });
}
