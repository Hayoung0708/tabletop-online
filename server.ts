import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { Server, type DefaultEventsMap } from "socket.io";
import { parseCookie } from "cookie";
import { GUEST_COOKIE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { totalScore, type Category } from "@/lib/yatzy";
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

const port = parseInt(process.env.PORT || "3000", 10);
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "/", true);
    handle(req, res, parsedUrl);
  });

  const io = new Server<
    DefaultEventsMap,
    DefaultEventsMap,
    DefaultEventsMap,
    SocketData
  >(httpServer, {
    path: "/socket.io",
  });

  // A page refresh disconnects the socket for a moment before the client
  // reconnects. Give a reconnecting player a grace window before treating
  // them as gone for good, so a refresh doesn't evict them from the game.
  const RECONNECT_GRACE_MS = 3_000;
  const lastPlayerTimers = new Map<string, NodeJS.Timeout>();

  function clearLastPlayerTimer(code: string) {
    const timer = lastPlayerTimers.get(code);
    if (timer) {
      clearTimeout(timer);
      lastPlayerTimers.delete(code);
    }
  }

  // Re-checks current state (not a snapshot from when the timer was set) so a
  // reconnect in the meantime naturally makes this a no-op.
  async function finalizeIfStillGone(code: string) {
    const room = getRoom(code);
    if (!room) return;

    if (isRoomEmpty(room)) {
      deleteRoom(room.code);
      await prisma.room.delete({ where: { code: room.code } }).catch(() => {});
      return;
    }

    // Still waiting to start: whoever didn't come back just leaves the list,
    // so they stop padding the player count and blocking/enabling the start.
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
  }

  // Shared by both an intentional leave (immediate) and a raw socket
  // disconnect (grace period, since that also covers page refreshes).
  async function markLeftAndFinalize(
    code: string,
    userId: string,
    immediate: boolean
  ) {
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
    } else {
      lastPlayerTimers.set(
        room.code,
        setTimeout(() => {
          lastPlayerTimers.delete(room.code);
          finalizeIfStillGone(room.code).catch((err) => console.error(err));
        }, RECONNECT_GRACE_MS)
      );
    }
  }

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

        const isMember = dbRoom.players.some(
          (p) => p.playerId === socket.data.userId
        );
        if (!isMember) {
          socket.emit("error_message", "참가하지 않은 방입니다.");
          return;
        }

        roomCode = code;
        socket.join(code);

        const room = createOrGetRoom(
          dbRoom.id,
          code,
          dbRoom.hostId,
          dbRoom.maxPlayers
        );

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
        // startGame drops anyone still disconnected — keep the DB in step.
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
        // startGame may have pruned disconnected players before rejecting —
        // push the trimmed list out so the room doesn't show stale entries.
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

    socket.on(
      "score_category",
      async ({ category }: { category: Category }) => {
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
                  where: {
                    roomId_playerId: { roomId: room.dbId, playerId: p.userId },
                  },
                  data: { score: totalScore(p.scorecard) },
                })
              )
            );
            await prisma.room.update({
              where: { code: roomCode! },
              data: { status: "FINISHED", finishedAt: new Date() },
            });
          }
        } catch (err) {
          socket.emit("error_message", (err as Error).message);
        }
      }
    );

    socket.on("emote", ({ x, y }: { x: number; y: number }) => {
      if (!roomCode) return;
      io.to(roomCode).emit("emote", { x, y, userId: socket.data.userId });
    });

    // Intentional exit (나가기 button) — process immediately, no grace period.
    socket.on("leave_room", async () => {
      if (!roomCode) return;
      const code = roomCode;
      roomCode = null;
      socket.leave(code);
      await markLeftAndFinalize(code, socket.data.userId, true);
    });

    // Raw socket drop (closed tab, network blip, page refresh) — grace period
    // applies since a refresh looks identical to this until it reconnects.
    socket.on("disconnect", async () => {
      if (!roomCode) return;
      await markLeftAndFinalize(roomCode, socket.data.userId, false);
    });
  });

  // Periodically clean up rooms that were created but never actually
  // joined (e.g. the creator closed the tab before entering a nickname).
  setInterval(async () => {
    try {
      const stale = await prisma.room.findMany({
        where: {
          status: "WAITING",
          players: { none: {} },
          createdAt: { lt: new Date(Date.now() - 60_000) },
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
  }, 30_000);

  httpServer.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
  });
});
