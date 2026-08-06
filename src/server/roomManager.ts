import {
  CATEGORIES,
  type Category,
  type Scorecard,
  calculateScore,
  emptyScorecard,
  rollDice,
  totalScore,
} from "@/lib/yatzy";

const TOTAL_TURNS = CATEGORIES.length;

export interface PlayerState {
  userId: string;
  nickname: string;
  seat: number;
  scorecard: Scorecard;
  connected: boolean;
  turnsTaken: number;
}

export type RoomStatus = "WAITING" | "PLAYING" | "FINISHED";

export interface RoomState {
  dbId: string;
  code: string;
  hostId: string;
  maxPlayers: number;
  status: RoomStatus;
  players: PlayerState[];
  dice: number[];
  held: boolean[];
  rollsLeft: number;
  currentPlayerIndex: number;
  winnerUserId: string | null;
}

const rooms = new Map<string, RoomState>();

export function getRoom(code: string): RoomState | undefined {
  return rooms.get(code);
}

export function createOrGetRoom(
  dbId: string,
  code: string,
  hostId: string,
  maxPlayers: number
): RoomState {
  const existing = rooms.get(code);
  if (existing) return existing;

  const room: RoomState = {
    dbId,
    code,
    hostId,
    maxPlayers,
    status: "WAITING",
    players: [],
    dice: [1, 1, 1, 1, 1],
    held: [false, false, false, false, false],
    rollsLeft: 3,
    currentPlayerIndex: 0,
    winnerUserId: null,
  };
  rooms.set(code, room);
  return room;
}

export function addPlayer(
  room: RoomState,
  userId: string,
  nickname: string
): PlayerState {
  const existing = room.players.find((p) => p.userId === userId);
  if (existing) {
    existing.connected = true;
    existing.nickname = nickname;
    return existing;
  }

  // room.players.length collides with a remaining player's seat once
  // someone other than the last-seated one has left — always seat past the
  // highest taken seat instead.
  const nextSeat = room.players.reduce((max, p) => Math.max(max, p.seat), -1) + 1;

  const player: PlayerState = {
    userId,
    nickname,
    seat: nextSeat,
    scorecard: emptyScorecard(),
    connected: true,
    turnsTaken: 0,
  };
  room.players.push(player);
  return player;
}

export function setConnected(
  room: RoomState,
  userId: string,
  connected: boolean
) {
  const player = room.players.find((p) => p.userId === userId);
  if (player) player.connected = connected;
}

export function isRoomEmpty(room: RoomState): boolean {
  return room.players.every((p) => !p.connected);
}

export function deleteRoom(code: string) {
  rooms.delete(code);
}

// If the current host disconnected, hand hostship to the next connected
// player (by seat order). Returns the new host's userId, or null if no
// reassignment happened.
export function reassignHostIfNeeded(room: RoomState): string | null {
  const host = room.players.find((p) => p.userId === room.hostId);
  if (host?.connected) return null;

  const nextHost = room.players
    .filter((p) => p.connected)
    .sort((a, b) => a.seat - b.seat)[0];
  if (!nextHost) return null;

  room.hostId = nextHost.userId;
  return nextHost.userId;
}

export interface LastPlayerStandingResult {
  winnerUserId: string;
  removedPlayerIds: string[];
}

// When a game is in progress and everyone but one player has disconnected,
// declare that player the winner and reset the room back to a fresh
// waiting room (rather than the normal end-of-game screen).
export function checkLastPlayerStanding(
  room: RoomState
): LastPlayerStandingResult | null {
  if (room.status !== "PLAYING") return null;

  const connected = room.players.filter((p) => p.connected);
  if (connected.length !== 1) return null;

  const winner = connected[0];
  const removedPlayerIds = room.players
    .filter((p) => p.userId !== winner.userId)
    .map((p) => p.userId);

  room.players = [
    { ...winner, seat: 0, scorecard: emptyScorecard(), turnsTaken: 0 },
  ];
  room.status = "WAITING";
  room.winnerUserId = winner.userId;
  room.hostId = winner.userId;
  room.dice = [1, 1, 1, 1, 1];
  room.held = [false, false, false, false, false];
  room.rollsLeft = 3;
  room.currentPlayerIndex = 0;

  return { winnerUserId: winner.userId, removedPlayerIds };
}

// Drop players who never came back from a disconnect. Only meaningful while
// WAITING — a live game keeps them listed so the scoreboard stays intact.
// Returns the userIds that were removed.
export function removeDisconnectedPlayers(room: RoomState): string[] {
  if (room.status !== "WAITING") return [];

  const gone = room.players.filter((p) => !p.connected).map((p) => p.userId);
  if (gone.length === 0) return [];

  room.players = room.players
    .filter((p) => p.connected)
    .map((p, i) => ({ ...p, seat: i }));

  return gone;
}

function currentPlayer(room: RoomState): PlayerState {
  return room.players[room.currentPlayerIndex];
}

export function startGame(room: RoomState, requesterId: string): void {
  if (room.hostId !== requesterId) throw new Error("호스트만 시작할 수 있습니다.");
  if (room.status !== "WAITING") throw new Error("이미 시작된 게임입니다.");
  // Someone mid-disconnect must not pad the count into a "playable" game.
  removeDisconnectedPlayers(room);
  if (room.players.length < 2) throw new Error("최소 2명이 필요합니다.");

  room.status = "PLAYING";
  room.currentPlayerIndex = 0;
  room.dice = [1, 1, 1, 1, 1];
  room.held = [false, false, false, false, false];
  room.rollsLeft = 3;
  room.winnerUserId = null;
  for (const p of room.players) {
    p.scorecard = emptyScorecard();
    p.turnsTaken = 0;
  }
}

export function rollDiceForRoom(room: RoomState, requesterId: string): void {
  assertTurn(room, requesterId);
  if (room.rollsLeft <= 0) throw new Error("더 이상 굴릴 수 없습니다.");

  const fresh = rollDice(5);
  room.dice = room.dice.map((v, i) => (room.held[i] ? v : fresh[i]));
  room.rollsLeft -= 1;
}

export function toggleHold(
  room: RoomState,
  requesterId: string,
  dieIndex: number
): void {
  assertTurn(room, requesterId);
  if (room.rollsLeft === 3) throw new Error("먼저 주사위를 굴려주세요.");
  if (dieIndex < 0 || dieIndex > 4) throw new Error("잘못된 주사위입니다.");

  room.held[dieIndex] = !room.held[dieIndex];
}

export interface ScoreResult {
  finished: boolean;
  winnerUserId: string | null;
}

export function scoreCategory(
  room: RoomState,
  requesterId: string,
  category: Category
): ScoreResult {
  assertTurn(room, requesterId);
  if (room.rollsLeft === 3) throw new Error("먼저 주사위를 굴려주세요.");

  const player = currentPlayer(room);
  const score = calculateScore(category, room.dice);

  // Repeat yahtzees stack: once the box already holds a genuine 50, a fresh
  // five-of-a-kind adds another 50 instead of being blocked as "already filled".
  if (category === "yahtzee" && player.scorecard.yahtzee) {
    if (score === 0) throw new Error("이미 채운 항목입니다.");
    player.scorecard.yahtzee += score;
  } else {
    if (player.scorecard[category] !== null) {
      throw new Error("이미 채운 항목입니다.");
    }
    player.scorecard[category] = score;
  }

  player.turnsTaken += 1;
  room.dice = [1, 1, 1, 1, 1];
  room.held = [false, false, false, false, false];
  room.rollsLeft = 3;

  // Yahtzee is exactly 13 turns per player — stacking a repeat yahtzee still
  // spends a turn, so a player can run out of turns with categories still
  // open. Those are scored 0 rather than leaving the game stuck open.
  const allDone = room.players.every((p) => p.turnsTaken >= TOTAL_TURNS);

  if (allDone) {
    for (const p of room.players) {
      for (const cat of CATEGORIES) {
        if (p.scorecard[cat] === null) p.scorecard[cat] = 0;
      }
    }
    room.status = "FINISHED";
    let winner = room.players[0];
    for (const p of room.players) {
      if (totalScore(p.scorecard) > totalScore(winner.scorecard)) winner = p;
    }
    room.winnerUserId = winner.userId;
    return { finished: true, winnerUserId: winner.userId };
  }

  room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
  return { finished: false, winnerUserId: null };
}

function assertTurn(room: RoomState, requesterId: string) {
  if (room.status !== "PLAYING") throw new Error("게임이 진행 중이 아닙니다.");
  if (currentPlayer(room)?.userId !== requesterId) {
    throw new Error("당신의 차례가 아닙니다.");
  }
}

export function publicRoomState(room: RoomState) {
  return {
    code: room.code,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    status: room.status,
    players: room.players.map((p) => ({
      userId: p.userId,
      nickname: p.nickname,
      seat: p.seat,
      scorecard: p.scorecard,
      connected: p.connected,
      total: totalScore(p.scorecard),
    })),
    dice: room.dice,
    held: room.held,
    rollsLeft: room.rollsLeft,
    currentPlayerIndex: room.currentPlayerIndex,
    currentPlayerId: room.players[room.currentPlayerIndex]?.userId ?? null,
    winnerUserId: room.winnerUserId,
  };
}

export type PublicRoomState = ReturnType<typeof publicRoomState>;
