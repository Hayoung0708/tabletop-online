import { NextResponse } from "next/server";
import { getOrCreateGuestId } from "@/server/guestAuth";
import { GAMES } from "@/constants/games";
import { prisma } from "@/lib/prisma";

const ROOM_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const ROOM_LIST_LIMIT = 30;
const CODE_CLASH_RETRY_LIMIT = 5;
const MIN_MAX_PLAYERS = 2;
const MAX_MAX_PLAYERS = 6;
const DEFAULT_MAX_PLAYERS = 6;
const ROOM_NAME_MAX_LENGTH = 20;
const DEFAULT_ROOM_NAME = "한 판 하실 분";
const DEFAULT_GAME_TYPE = "YATZY";

/**
 * 헷갈리기 쉬운 글자(0/O, 1/I 등)를 뺀 문자로 방 코드를 만든다.
 * @returns 새 방 코드
 */
const generateRoomCode = (): string => {
  let code = "";
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  }
  return code;
};

/**
 * 참가자가 있는 공개 대기 방 목록을 최신순으로 반환한다.
 * @returns 방 목록 응답
 */
export const GET = async (): Promise<NextResponse> => {
  const rooms = await prisma.room.findMany({
    where: { status: "WAITING", isPrivate: false, players: { some: {} } },
    orderBy: { createdAt: "desc" },
    take: ROOM_LIST_LIMIT,
    include: {
      players: { include: { player: { select: { nickname: true } } } },
    },
  });

  return NextResponse.json({
    rooms: rooms.map((room) => ({
      code: room.code,
      name: room.name,
      gameType: room.gameType,
      maxPlayers: room.maxPlayers,
      playerCount: room.players.length,
      nicknames: room.players.map((p) => p.player.nickname),
      createdAt: room.createdAt,
    })),
  });
};

/**
 * 새 방을 만들고, 요청자를 방장으로 지정한다.
 * @param request - 방 생성 옵션이 담긴 요청
 * @returns 생성된 방 코드 응답
 */
export const POST = async (request: Request): Promise<NextResponse> => {
  const guestId = await getOrCreateGuestId();
  const body = await request.json().catch(() => ({}));

  const maxPlayers = Math.min(
    MAX_MAX_PLAYERS,
    Math.max(MIN_MAX_PLAYERS, Number(body?.maxPlayers) || DEFAULT_MAX_PLAYERS),
  );
  // 지원 목록은 로비에 노출되는 게임 목록에서 그대로 가져온다 — 여기에 따로
  // 적어 두면 게임을 추가할 때 빠뜨려 엉뚱한 게임으로 방이 만들어진다.
  const gameType = GAMES.some((g) => g.id === body?.gameType && !g.disabled)
    ? body.gameType
    : DEFAULT_GAME_TYPE;
  const isPrivate = Boolean(body?.isPrivate);
  const name =
    String(body?.name ?? "")
      .trim()
      .slice(0, ROOM_NAME_MAX_LENGTH) || DEFAULT_ROOM_NAME;

  let code = generateRoomCode();
  for (let attempts = 0; attempts < CODE_CLASH_RETRY_LIMIT; attempts++) {
    const clash = await prisma.room.findUnique({ where: { code } });
    if (!clash) break;
    code = generateRoomCode();
  }

  const room = await prisma.room.create({
    data: { code, name, gameType, isPrivate, hostId: guestId, maxPlayers },
  });

  return NextResponse.json({ code: room.code });
};
