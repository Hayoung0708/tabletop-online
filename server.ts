import "dotenv/config";
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { Server, type DefaultEventsMap, type RemoteSocket } from "socket.io";
import { parseCookie } from "cookie";
import { GUEST_COOKIE } from "@/constants/app";
import { GAMES } from "@/constants/games";
import { prisma } from "@/lib/prisma";
import type { Category } from "@/utils/yatzy";
import {
  addPlayer,
  assertCanStartGame,
  createOrGetRoom,
  deleteRoom,
  getRoom,
  isRoomEmpty,
  reassignHostIfNeeded,
  removeDisconnectedPlayers,
  setConnected,
  updateRoomSettings,
  type RoomState,
} from "@/server/roomManager";
import {
  buildPublicRoomState,
  checkLastPlayerStanding,
  createIdleGame,
  startGameData,
} from "@/server/gameDispatch";
import {
  rollDiceForRoom,
  scoreCategory,
  toggleHold,
  publicYatzyGameState,
} from "@/server/yatzy/gameLogic";
import {
  applyPendingRefill,
  burnPile,
  commitFaceDownPickup,
  commitFaceDownPlay,
  commitFaceDownToHand,
  finalizeGameOver,
  pickUpPile,
  playFromHandOrFaceUp,
  revealFaceDown,
  selectFaceUpCards,
  type PlayResult,
} from "@/server/shithead/gameLogic";
import {
  drawOneCards,
  finalizeOneCardGameOver,
  oneCardRankOf,
  playOneCard,
} from "@/server/onecard/gameLogic";
import type { Suit } from "@/server/shithead/deck";
import {
  BURN_HOLD_MS,
  CARD_FLIGHT_DURATION_MS,
  FACE_DOWN_FLIP_MS,
  FACE_DOWN_HOLD_MS,
  GAME_OVER_HOLD_MS,
  HAND_SHIFT_MS,
  SHITHEAD_MAX_PLAYERS,
} from "@/constants/shithead";
import { cardsFlightMs } from "@/utils/shithead";

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

  /**
   * 방 상태를 방에 있는 모든 소켓에 각자 맞는 시점으로 보낸다. 싯헤드는
   * 보는 사람마다 손패 노출 여부가 달라서 한 번에 broadcast할 수 없다.
   * @param room - 대상 방
   */
  const broadcastRoomState = async (room: RoomState): Promise<void> => {
    const sockets: RemoteSocket<DefaultEventsMap, SocketData>[] = await io
      .in(room.code)
      .fetchSockets();
    for (const socket of sockets) {
      socket.emit("room_state", buildPublicRoomState(room, socket.data.userId));
    }
  };

  /**
   * 야찌 게임이 끝났을 때 각 플레이어의 최종 점수를 DB에 반영한다.
   * @param room - 대상 방 (game.type === "YATZY")
   */
  const persistYatzyResults = async (room: RoomState): Promise<void> => {
    const { totals } = publicYatzyGameState(room);
    await Promise.all(
      room.players.map((p) =>
        prisma.roomPlayer.update({
          where: { roomId_playerId: { roomId: room.dbId, playerId: p.userId } },
          data: { score: totals[p.userId] },
        }),
      ),
    );
    await prisma.room.update({
      where: { code: room.code },
      data: { status: "FINISHED", finishedAt: new Date() },
    });
  };

  /**
   * 싯헤드 게임이 끝났을 때 각 플레이어의 등수를 DB에 반영한다.
   * @param room - 대상 방 (game.type === "SHITHEAD")
   */
  const persistShitheadResults = async (room: RoomState): Promise<void> => {
    if (room.game.type !== "SHITHEAD") return;
    const { finishedOrder } = room.game;
    await Promise.all(
      room.players.map((p) =>
        prisma.roomPlayer.update({
          where: { roomId_playerId: { roomId: room.dbId, playerId: p.userId } },
          data: { score: finishedOrder.indexOf(p.userId) + 1 },
        }),
      ),
    );
    await prisma.room.update({
      where: { code: room.code },
      data: { status: "FINISHED", finishedAt: new Date() },
    });
  };

  /**
   * 원카드 게임이 끝났을 때 각 플레이어의 등수를 DB에 반영한다.
   * @param room - 대상 방 (game.type === "ONECARD")
   */
  const persistOneCardResults = async (room: RoomState): Promise<void> => {
    if (room.game.type !== "ONECARD") return;
    await Promise.all(
      room.players.map((p) =>
        prisma.roomPlayer.update({
          where: { roomId_playerId: { roomId: room.dbId, playerId: p.userId } },
          data: { score: oneCardRankOf(room, p.userId) },
        }),
      ),
    );
    await prisma.room.update({
      where: { code: room.code },
      data: { status: "FINISHED", finishedAt: new Date() },
    });
  };

  /**
   * 원카드 게임이 끝났을 때: 마지막 카드 비행/파산 정리 연출이 끝날 때까지
   * 기다렸다가 결과 화면으로 전환하고 등수를 저장한다.
   * @param room - 대상 방
   * @param delay - 결과 화면 전환까지 기다릴 시간(ms)
   */
  const scheduleOneCardGameOver = (room: RoomState, delay: number): void => {
    setTimeout(() => {
      void (async (): Promise<void> => {
        finalizeOneCardGameOver(room);
        await broadcastRoomState(room);
        await persistOneCardResults(room);
      })();
    }, delay);
  };

  /**
   * 손패/얼굴카드에서 카드를 낸(또는 바닥패를 뒤집어 낸) 뒤 공통으로 해야
   * 하는 뒷일을 예약한다. 손패/더미 갱신은 항상 바로 알린다 — 늦추면 낸
   * 카드가 손패에 남아있다가 갑자기 사라지는 것처럼 보인다. 게임이
   * 끝났으면 결과 화면 전환만 카드가 다 도착할 때까지 따로 미루고, 아니면
   * 재정렬이 끝난 뒤 손패를 채우고(필요하면) 카드가 쌓인 모습을 보여준 뒤
   * 더미를 태운다(필요하면).
   * @param roomCode - 대상 방 코드
   * @param room - 대상 방
   * @param requesterId - 방금 카드를 낸 플레이어
   * @param result - playFromHandOrFaceUp/commitFaceDownPlay의 결과
   */
  const scheduleAfterShitheadPlay = (
    roomCode: string,
    room: RoomState,
    requesterId: string,
    result: PlayResult,
  ): void => {
    void broadcastRoomState(room);

    if (result.gameOver) {
      const delay = cardsFlightMs(result.played.length) + GAME_OVER_HOLD_MS;
      setTimeout(() => {
        void (async (): Promise<void> => {
          finalizeGameOver(room);
          await broadcastRoomState(room);
          await persistShitheadResults(room);
        })();
      }, delay);
      return;
    }

    if (result.refilled > 0) {
      setTimeout(() => {
        void (async (): Promise<void> => {
          applyPendingRefill(room, requesterId);
          await broadcastRoomState(room);
        })();
      }, HAND_SHIFT_MS);
    }

    if (result.burned) {
      const delay = cardsFlightMs(result.played.length) + BURN_HOLD_MS;
      setTimeout(() => {
        void (async (): Promise<void> => {
          const burnedCards = burnPile(room);
          io.to(roomCode).emit("shithead_pile_burned", { cards: burnedCards });
          await broadcastRoomState(room);
        })();
      }, delay);
    }
  };

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

      await broadcastRoomState(room);
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

    await broadcastRoomState(room);
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
      await broadcastRoomState(room);
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

        const room = createOrGetRoom(
          dbRoom.id,
          code,
          dbRoom.name,
          dbRoom.hostId,
          dbRoom.maxPlayers,
          createIdleGame(dbRoom.gameType),
        );

        if (room.players.length === 0) {
          for (const p of [...dbRoom.players].sort((a, b) => a.seat - b.seat)) {
            addPlayer(room, p.playerId, p.player.nickname ?? "플레이어");
          }
        } else {
          addPlayer(room, socket.data.userId, socket.data.nickname);
        }

        clearLastPlayerTimer(code);
        await broadcastRoomState(room);
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
        assertCanStartGame(
          room,
          socket.data.userId,
          room.game.type === "SHITHEAD" ? SHITHEAD_MAX_PLAYERS : undefined,
        );
        startGameData(room);
        if (room.game.type === "SHITHEAD") {
          io.to(roomCode).emit("shithead_deal", {
            playerIds: room.players.map((p) => p.userId),
          });
        }
        // 시작 직전에 연결 끊긴 플레이어를 걸러냈으니 DB도 맞춰준다.
        const kept = room.players.map((p) => p.userId);
        await prisma.roomPlayer.deleteMany({
          where: { roomId: room.dbId, playerId: { notIn: kept } },
        });
        await prisma.room.update({
          where: { code: roomCode },
          data: { status: "PLAYING" },
        });
        await broadcastRoomState(room);
      } catch (err) {
        socket.emit("error_message", (err as Error).message);
        // 시작 조건 확인 중 이미 연결 끊긴 플레이어를 걸러냈을 수 있어,
        // 걸러진 목록을 내보내야 방 화면이 낡은 목록을 보여주지 않는다.
        await broadcastRoomState(room);
      }
    });

    socket.on(
      "update_room",
      async ({ name, gameType }: { name: string; gameType: string }) => {
        if (!roomCode) return;
        const room = getRoom(roomCode);
        if (!room) return;

        try {
          if (!GAMES.some((g) => g.id === gameType && !g.disabled)) {
            throw new Error("아직 지원하지 않는 게임입니다.");
          }
          updateRoomSettings(room, socket.data.userId, name, createIdleGame(gameType));
          await prisma.room.update({
            where: { code: roomCode },
            data: { name: room.name, gameType },
          });
          await broadcastRoomState(room);
        } catch (err) {
          socket.emit("error_message", (err as Error).message);
        }
      },
    );

    socket.on("roll_dice", async () => {
      if (!roomCode) return;
      const room = getRoom(roomCode);
      if (!room) return;

      try {
        rollDiceForRoom(room, socket.data.userId);
        await broadcastRoomState(room);
      } catch (err) {
        socket.emit("error_message", (err as Error).message);
      }
    });

    socket.on("toggle_hold", async ({ dieIndex }: { dieIndex: number }) => {
      if (!roomCode) return;
      const room = getRoom(roomCode);
      if (!room) return;

      try {
        toggleHold(room, socket.data.userId, dieIndex);
        await broadcastRoomState(room);
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
        await broadcastRoomState(room);
        if (result.finished) await persistYatzyResults(room);
      } catch (err) {
        socket.emit("error_message", (err as Error).message);
      }
    });

    socket.on("shithead_select_face_up", async ({ cardIds }: { cardIds: string[] }) => {
      if (!roomCode) return;
      const room = getRoom(roomCode);
      if (!room) return;

      try {
        selectFaceUpCards(room, socket.data.userId, cardIds);
        await broadcastRoomState(room);
      } catch (err) {
        socket.emit("error_message", (err as Error).message);
      }
    });

    socket.on("shithead_play", ({ cardIds }: { cardIds: string[] }) => {
      if (!roomCode) return;
      const code = roomCode;
      const room = getRoom(code);
      if (!room) return;

      try {
        const result = playFromHandOrFaceUp(room, socket.data.userId, cardIds);
        if (result.played.length > 0) {
          io.to(code).emit("shithead_play", {
            playerId: socket.data.userId,
            cards: result.played,
            refilled: result.refilled,
          });
        }
        scheduleAfterShitheadPlay(code, room, socket.data.userId, result);
      } catch (err) {
        socket.emit("error_message", (err as Error).message);
      }
    });

    socket.on("shithead_play_face_down", ({ index }: { index: number }) => {
      if (!roomCode) return;
      const code = roomCode;
      const room = getRoom(code);
      if (!room) return;

      try {
        const { card, accepted } = revealFaceDown(room, socket.data.userId, index);
        // 먼저 뒤집힌 카드만 공개해 클라이언트가 뒤집기+대기 연출을 재생하게
        // 하고, 실제 게임 상태 반영(더미/손패 갱신)은 연출이 끝난 뒤로 미룬다.
        io.to(code).emit("shithead_face_down_reveal", {
          playerId: socket.data.userId,
          index,
          card,
          accepted,
        });

        setTimeout(() => {
          void (async (): Promise<void> => {
            if (accepted) {
              const result = commitFaceDownPlay(room, socket.data.userId, index);
              io.to(code).emit("shithead_play", {
                playerId: socket.data.userId,
                cards: result.played,
                refilled: result.refilled,
              });
              scheduleAfterShitheadPlay(code, room, socket.data.userId, result);
              return;
            }

            // 낼 수 없는 카드 — 뒤집힌 카드부터 손패로 옮기는 모습을 먼저
            // 보여주고, 그 애니메이션이 끝난 뒤 더미 전체를 마저 가져온다.
            commitFaceDownToHand(room, socket.data.userId, index);
            io.to(code).emit("shithead_face_down_to_hand", {
              playerId: socket.data.userId,
              index,
            });
            await broadcastRoomState(room);

            setTimeout(() => {
              void (async (): Promise<void> => {
                const pickedUp = commitFaceDownPickup(room, socket.data.userId);
                io.to(code).emit("shithead_pickup", {
                  playerId: socket.data.userId,
                  count: pickedUp,
                });
                await broadcastRoomState(room);
              })();
            }, CARD_FLIGHT_DURATION_MS);
          })();
        }, FACE_DOWN_FLIP_MS + FACE_DOWN_HOLD_MS);
      } catch (err) {
        socket.emit("error_message", (err as Error).message);
      }
    });

    socket.on("shithead_pick_up_pile", async () => {
      if (!roomCode) return;
      const room = getRoom(roomCode);
      if (!room) return;

      try {
        const taken = pickUpPile(room, socket.data.userId);
        io.to(roomCode).emit("shithead_pickup", {
          playerId: socket.data.userId,
          count: taken,
        });
        await broadcastRoomState(room);
      } catch (err) {
        socket.emit("error_message", (err as Error).message);
      }
    });

    socket.on(
      "onecard_play",
      async ({ cardId, suit }: { cardId: string; suit?: Suit }) => {
        if (!roomCode) return;
        const code = roomCode;
        const room = getRoom(code);
        if (!room) return;

        try {
          const result = playOneCard(room, socket.data.userId, cardId, suit);
          // 낸 카드가 손에서 더미로 날아가는 연출용 — 싯헤드와 같은 오버레이를 쓴다.
          io.to(code).emit("onecard_play", {
            playerId: socket.data.userId,
            cards: [result.played],
          });
          await broadcastRoomState(room);
          if (result.gameOver) {
            scheduleOneCardGameOver(room, cardsFlightMs(1) + GAME_OVER_HOLD_MS);
          }
        } catch (err) {
          socket.emit("error_message", (err as Error).message);
        }
      },
    );

    socket.on("onecard_draw", async () => {
      if (!roomCode) return;
      const room = getRoom(roomCode);
      if (!room) return;

      try {
        const result = drawOneCards(room, socket.data.userId);
        // 새 카드가 덱에서 손패로 날아오는 연출은 손패 증가를 감지하는
        // useHandGrowIn이 처리한다. 여기서는 어떤 소리를 낼지만 미리 알린다
        // (공격 벌칙이면 더미를 쓸어오는 소리, 아니면 덱에서 뽑는 소리).
        io.to(roomCode).emit("onecard_draw", {
          playerId: socket.data.userId,
          penalty: result.drawn > 1,
        });
        await broadcastRoomState(room);
        if (result.gameOver) {
          scheduleOneCardGameOver(room, GAME_OVER_HOLD_MS);
        }
      } catch (err) {
        socket.emit("error_message", (err as Error).message);
      }
    });

    socket.on("emote", ({ emoteId }: { emoteId: string }) => {
      if (!roomCode) return;
      io.to(roomCode).emit("emote", { emoteId, userId: socket.data.userId });
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
