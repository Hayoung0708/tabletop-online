import "dotenv/config";
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { Server, type DefaultEventsMap } from "socket.io";
import { parseCookie } from "cookie";
import { GUEST_COOKIE } from "@/constants/app";
import { prisma } from "@/lib/prisma";
import { totalScore, type Category } from "@/utils/yatzy";
import {
  addPlayer,
  checkLastPlayerStanding,
  createOrGetRoom,
  deleteRoom,
  getRoom,
  isRoomEmpty,
  publicRoomState,
  reassignHostIfNeeded,
  removeDisconnectedPlayers,
  rollDiceForRoom,
  scoreCategory,
  setConnected,
  startGame,
  toggleHold,
} from "@/server/roomManager";

interface SocketData {
  userId: string;
  nickname: string;
}

// 새로고침되면 소켓이 잠깐 끊겼다가 다시 붙는다. 재접속 유예 시간을 두어
// 새로고침만으로 게임에서 튕겨나가지 않게 한다.
const RECONNECT_GRACE_MS = 3_000;
// 만들어졌지만 아무도 들어오지 않은 방(생성자가 닉네임 입력 전 탭을 닫은 경우
// 등)을 주기적으로 정리하는 간격.
const STALE_ROOM_SWEEP_INTERVAL_MS = 30_000;
const STALE_ROOM_AGE_MS = 60_000;

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  const io = new Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>(
    httpServer,
    { path: "/socket.io" },
  );

  const lastPlayerTimers = new Map<string, NodeJS.Timeout>();

  /**
   * 대기 중인 재접속 유예 타이머를 취소한다.
   * @param code - 방 코드
   */
  const clearLastPlayerTimer = (code: string): void => {
    const timer = lastPlayerTimers.get(code);
    if (timer) {
      clearTimeout(timer);
      lastPlayerTimers.delete(code);
    }
  };

  /**
   * 유예 시간이 지난 뒤에도 여전히 나간 상태인지 다시 확인하고 상황에 맞게
   * 정리한다. 타이머 설정 시점의 스냅샷이 아니라 지금 상태를 다시 조회하므로,
   * 그사이 재접속했으면 자연히 아무 일도 하지 않는다.
   * @param code - 방 코드
   */
  const finalizeIfStillGone = async (code: string): Promise<void> => {
    const room = getRoom(code);
    if (!room) return;

    if (isRoomEmpty(room)) {
      deleteRoom(room.code);
      await prisma.room.delete({ where: { code: room.code } }).catch(() => {});
      return;
    }

    // 아직 대기 중이면: 돌아오지 않은 사람은 목록에서 빼서 인원수와 시작
    // 가능 여부를 부풀리지 않게 한다.
    if (room.status === "WAITING") {
      const removed = removeDisconnectedPlayers(room);
      if (removed.length === 0) return;

      try {
        await prisma.roomPlayer.deleteMany({
          where: { roomId: room.dbId, playerId: { in: removed } },
        });
        await prisma.room.update({
          where: { code: room.code },
          data: { hostId: room.hostId },
        });
      } catch (err) {
        console.error(err);
      }

      io.to(room.code).emit("room_state", publicRoomState(room));
      return;
    }

    const connectedCount = room.players.filter((p) => p.connected).length;
    if (room.status !== "PLAYING" || connectedCount !== 1) return;

    const standing = checkLastPlayerStanding(room);
    if (!standing) return;

    try {
      await prisma.roomPlayer.deleteMany({
        where: { roomId: room.dbId, playerId: { in: standing.removedPlayerIds } },
      });
      await prisma.room.update({
        where: { code: room.code },
        data: { status: "WAITING", hostId: room.hostId },
      });
    } catch (err) {
      console.error(err);
    }

    io.to(room.code).emit("room_state", publicRoomState(room));
  };

  /**
   * 의도적 퇴장(즉시)과 순수 소켓 끊김(유예 후) 양쪽에서 함께 쓰는 처리.
   * @param code - 방 코드
   * @param userId - 나간 플레이어의 게스트 id
   * @param immediate - 유예 없이 바로 확정할지 여부
   */
  const markLeftAndFinalize = async (
    code: string,
    userId: string,
    immediate: boolean,
  ): Promise<void> => {
    const room = getRoom(code);
    if (!room) return;

    setConnected(room, userId, false);
    const newHostId = reassignHostIfNeeded(room);

    if (newHostId) {
      await prisma.room
        .update({ where: { code: room.code }, data: { hostId: newHostId } })
        .catch((err) => console.error(err));
    }

    if (!isRoomEmpty(room)) {
      io.to(room.code).emit("room_state", publicRoomState(room));
    }

    clearLastPlayerTimer(room.code);
    if (immediate) {
      await finalizeIfStillGone(room.code);
      return;
    }

    lastPlayerTimers.set(
      room.code,
      setTimeout(() => {
        lastPlayerTimers.delete(room.code);
        finalizeIfStillGone(room.code).catch((err) => console.error(err));
      }, RECONNECT_GRACE_MS),
    );
  };

  io.use(async (socket, nextFn) => {
    try {
      const cookieHeader = socket.request.headers.cookie ?? "";
      const cookies = parseCookie(cookieHeader);
      const guestId = cookies[GUEST_COOKIE];

      if (!guestId) {
        nextFn(new Error("NO_GUEST_ID"));
        return;
      }

      const player = await prisma.player.findUnique({ where: { id: guestId } });
      if (!player?.nickname) {
        nextFn(new Error("NO_NICKNAME"));
        return;
      }

      socket.data.userId = guestId;
      socket.data.nickname = player.nickname;
      nextFn();
    } catch {
      nextFn(new Error("AUTH_FAILED"));
    }
  });

  io.on("connection", (socket) => {
    let roomCode: string | null = null;

    socket.on("join_room", async ({ code }: { code: string }) => {
      try {
        const dbRoom = await prisma.room.findUnique({
          where: { code },
          include: { players: { include: { player: true } } },
        });

        if (!dbRoom) {
          socket.emit("error_message", "존재하지 않는 방입니다.");
          return;
        }

        const isMember = dbRoom.players.some((p) => p.playerId === socket.data.userId);
        if (!isMember) {
          socket.emit("error_message", "참가하지 않은 방입니다.");
          return;
        }

        roomCode = code;
        socket.join(code);

        const room = createOrGetRoom(dbRoom.id, code, dbRoom.hostId, dbRoom.maxPlayers);

        if (room.players.length === 0) {
          for (const p of [...dbRoom.players].sort((a, b) => a.seat - b.seat)) {
            addPlayer(room, p.playerId, p.player.nickname ?? "플레이어");
          }
        } else {
          addPlayer(room, socket.data.userId, socket.data.nickname);
        }

        clearLastPlayerTimer(code);
        io.to(code).emit("room_state", publicRoomState(room));
      } catch (err) {
        console.error(err);
        socket.emit("error_message", "방에 참가할 수 없습니다.");
      }
    });

    socket.on("start_game", async () => {
      if (!roomCode) return;
      const room = getRoom(roomCode);
      if (!room) return;

      try {
        startGame(room, socket.data.userId);
        // startGame이 여전히 연결 끊긴 사람을 걸러내므로 DB도 맞춰준다.
        const kept = room.players.map((p) => p.userId);
        await prisma.roomPlayer.deleteMany({
          where: { roomId: room.dbId, playerId: { notIn: kept } },
        });
        await prisma.room.update({
          where: { code: roomCode },
          data: { status: "PLAYING" },
        });
        io.to(roomCode).emit("room_state", publicRoomState(room));
      } catch (err) {
        socket.emit("error_message", (err as Error).message);
        // startGame이 실패 전에 이미 연결 끊긴 사람을 걸러냈을 수 있어,
        // 걸러진 목록을 내보내야 방 화면이 낡은 목록을 보여주지 않는다.
        io.to(roomCode).emit("room_state", publicRoomState(room));
      }
    });

    socket.on("roll_dice", () => {
      if (!roomCode) return;
      const room = getRoom(roomCode);
      if (!room) return;

      try {
        rollDiceForRoom(room, socket.data.userId);
        io.to(roomCode).emit("room_state", publicRoomState(room));
      } catch (err) {
        socket.emit("error_message", (err as Error).message);
      }
    });

    socket.on("toggle_hold", ({ dieIndex }: { dieIndex: number }) => {
      if (!roomCode) return;
      const room = getRoom(roomCode);
      if (!room) return;

      try {
        toggleHold(room, socket.data.userId, dieIndex);
        io.to(roomCode).emit("room_state", publicRoomState(room));
      } catch (err) {
        socket.emit("error_message", (err as Error).message);
      }
    });

    socket.on("score_category", async ({ category }: { category: Category }) => {
      if (!roomCode) return;
      const room = getRoom(roomCode);
      if (!room) return;

      try {
        const result = scoreCategory(room, socket.data.userId, category);
        io.to(roomCode).emit("room_state", publicRoomState(room));

        if (result.finished) {
          await Promise.all(
            room.players.map((p) =>
              prisma.roomPlayer.update({
                where: { roomId_playerId: { roomId: room.dbId, playerId: p.userId } },
                data: { score: totalScore(p.scorecard) },
              }),
            ),
          );
          await prisma.room.update({
            where: { code: roomCode as string },
            data: { status: "FINISHED", finishedAt: new Date() },
          });
        }
      } catch (err) {
        socket.emit("error_message", (err as Error).message);
      }
    });

    socket.on("emote", ({ x, y }: { x: number; y: number }) => {
      if (!roomCode) return;
      io.to(roomCode).emit("emote", { x, y, userId: socket.data.userId });
    });

    // 의도적 퇴장(나가기 버튼) — 유예 없이 즉시 처리한다.
    socket.on("leave_room", async () => {
      if (!roomCode) return;
      const code = roomCode;
      roomCode = null;
      socket.leave(code);
      await markLeftAndFinalize(code, socket.data.userId, true);
    });

    // 순수 소켓 끊김(탭 닫힘, 네트워크 문제, 새로고침) — 새로고침과 구분이
    // 안 되므로 유예를 둔다.
    socket.on("disconnect", async () => {
      if (!roomCode) return;
      await markLeftAndFinalize(roomCode, socket.data.userId, false);
    });
  });

  // 만들어졌지만 실제로 아무도 들어오지 않은 방을 주기적으로 정리한다.
  setInterval(async () => {
    try {
      const stale = await prisma.room.findMany({
        where: {
          status: "WAITING",
          players: { none: {} },
          createdAt: { lt: new Date(Date.now() - STALE_ROOM_AGE_MS) },
        },
        select: { code: true },
      });
      if (stale.length > 0) {
        await prisma.room.deleteMany({
          where: { code: { in: stale.map((r) => r.code) } },
        });
      }
    } catch (err) {
      console.error("room cleanup sweep failed", err);
    }
  }, STALE_ROOM_SWEEP_INTERVAL_MS);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
