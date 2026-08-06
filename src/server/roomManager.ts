import {
  CATEGORIES,
  type Category,
  type Scorecard,
  calculateScore,
  emptyScorecard,
  rollDice,
  totalScore,
} from "@/utils/yatzy";

const TOTAL_TURNS = CATEGORIES.length;
const INITIAL_DICE = [1, 1, 1, 1, 1];
const INITIAL_HELD = [false, false, false, false, false];
const MIN_PLAYERS_TO_START = 2;

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

/**
 * 방 코드로 인메모리 방 상태를 찾는다.
 * @param code - 방 코드
 * @returns 방 상태, 없으면 undefined
 */
export const getRoom = (code: string): RoomState | undefined => {
  return rooms.get(code);
};

/**
 * 인메모리 방 상태를 가져오거나, 없으면 새로 만든다.
 * @param dbId - DB상의 방 id
 * @param code - 방 코드
 * @param hostId - 방장 게스트 id
 * @param maxPlayers - 최대 인원
 * @returns 방 상태
 */
export const createOrGetRoom = (
  dbId: string,
  code: string,
  hostId: string,
  maxPlayers: number,
): RoomState => {
  const existing = rooms.get(code);
  if (existing) return existing;

  const room: RoomState = {
    dbId,
    code,
    hostId,
    maxPlayers,
    status: "WAITING",
    players: [],
    dice: [...INITIAL_DICE],
    held: [...INITIAL_HELD],
    rollsLeft: 3,
    currentPlayerIndex: 0,
    winnerUserId: null,
  };
  rooms.set(code, room);
  return room;
};

/**
 * 플레이어를 방에 등록한다. 이미 있으면 연결 상태와 닉네임만 갱신한다.
 * @param room - 대상 방
 * @param userId - 게스트 id
 * @param nickname - 닉네임
 * @returns 등록되거나 갱신된 플레이어
 */
export const addPlayer = (
  room: RoomState,
  userId: string,
  nickname: string,
): PlayerState => {
  const existing = room.players.find((p) => p.userId === userId);
  if (existing) {
    existing.connected = true;
    existing.nickname = nickname;
    return existing;
  }

  // room.players.length는 마지막에 앉은 사람이 아닌 다른 사람이 남아있는
  // 상태에서 나가면 좌석과 충돌한다. 항상 가장 큰 좌석번호+1을 써야 한다.
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
};

/**
 * 플레이어의 연결 상태를 갱신한다.
 * @param room - 대상 방
 * @param userId - 게스트 id
 * @param connected - 연결 여부
 */
export const setConnected = (
  room: RoomState,
  userId: string,
  connected: boolean,
): void => {
  const player = room.players.find((p) => p.userId === userId);
  if (player) player.connected = connected;
};

/**
 * 방에 연결된 플레이어가 한 명도 없는지 확인한다.
 * @param room - 대상 방
 * @returns 전원 연결 끊김 여부
 */
export const isRoomEmpty = (room: RoomState): boolean => {
  return room.players.every((p) => !p.connected);
};

/**
 * 인메모리에서 방을 제거한다.
 * @param code - 방 코드
 */
export const deleteRoom = (code: string): void => {
  rooms.delete(code);
};

export interface LastPlayerStandingResult {
  winnerUserId: string;
  removedPlayerIds: string[];
}

/**
 * 현재 방장이 연결 끊김 상태면, 연결된 다음 플레이어(좌석 순)에게 방장을
 * 넘긴다.
 * @param room - 대상 방
 * @returns 새 방장의 id, 위임이 없었으면 null
 */
export const reassignHostIfNeeded = (room: RoomState): string | null => {
  const host = room.players.find((p) => p.userId === room.hostId);
  if (host?.connected) return null;

  const [nextHost] = room.players
    .filter((p) => p.connected)
    .sort((a, b) => a.seat - b.seat);
  if (!nextHost) return null;

  room.hostId = nextHost.userId;
  return nextHost.userId;
};

/**
 * 게임 진행 중 한 명만 남고 모두 연결이 끊겼으면 그 한 명을 승자로 처리하고
 * 방을 새 대기방 상태로 되돌린다 (일반 종료 화면 대신).
 * @param room - 대상 방
 * @returns 승자와 제거된 플레이어 목록, 해당 없으면 null
 */
export const checkLastPlayerStanding = (
  room: RoomState,
): LastPlayerStandingResult | null => {
  if (room.status !== "PLAYING") return null;

  const connected = room.players.filter((p) => p.connected);
  if (connected.length !== 1) return null;

  const [winner] = connected;
  const removedPlayerIds = room.players
    .filter((p) => p.userId !== winner.userId)
    .map((p) => p.userId);

  room.players = [{ ...winner, seat: 0, scorecard: emptyScorecard(), turnsTaken: 0 }];
  room.status = "WAITING";
  room.winnerUserId = winner.userId;
  room.hostId = winner.userId;
  room.dice = [...INITIAL_DICE];
  room.held = [...INITIAL_HELD];
  room.rollsLeft = 3;
  room.currentPlayerIndex = 0;

  return { winnerUserId: winner.userId, removedPlayerIds };
};

/**
 * 재접속하지 못한 플레이어를 방에서 뺀다. WAITING 상태에서만 의미가 있고,
 * 진행 중인 게임은 점수판을 유지하기 위해 그대로 목록에 남긴다.
 * @param room - 대상 방
 * @returns 제거된 플레이어들의 userId
 */
export const removeDisconnectedPlayers = (room: RoomState): string[] => {
  if (room.status !== "WAITING") return [];

  const gone = room.players.filter((p) => !p.connected).map((p) => p.userId);
  if (gone.length === 0) return [];

  room.players = room.players
    .filter((p) => p.connected)
    .map((p, i) => ({ ...p, seat: i }));

  return gone;
};

/**
 * 현재 차례인 플레이어를 반환한다.
 * @param room - 대상 방
 * @returns 현재 차례 플레이어
 */
const currentPlayer = (room: RoomState): PlayerState => {
  return room.players[room.currentPlayerIndex];
};

/**
 * 게임을 시작한다. 방장만 시작할 수 있고, 최소 인원을 채워야 한다.
 * @param room - 대상 방
 * @param requesterId - 시작을 요청한 게스트 id
 */
export const startGame = (room: RoomState, requesterId: string): void => {
  if (room.hostId !== requesterId) throw new Error("호스트만 시작할 수 있습니다.");
  if (room.status !== "WAITING") throw new Error("이미 시작된 게임입니다.");
  // 연결이 끊긴 채로 남아있는 사람이 인원수를 부풀려 시작 가능한 것처럼
  // 보이면 안 되므로 먼저 정리한다.
  removeDisconnectedPlayers(room);
  if (room.players.length < MIN_PLAYERS_TO_START)
    throw new Error("최소 2명이 필요합니다.");

  room.status = "PLAYING";
  room.currentPlayerIndex = 0;
  room.dice = [...INITIAL_DICE];
  room.held = [...INITIAL_HELD];
  room.rollsLeft = 3;
  room.winnerUserId = null;
  for (const p of room.players) {
    p.scorecard = emptyScorecard();
    p.turnsTaken = 0;
  }
};

/**
 * 주사위를 굴린다. 홀드된 주사위는 그대로 두고 나머지만 다시 굴린다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 */
export const rollDiceForRoom = (room: RoomState, requesterId: string): void => {
  assertTurn(room, requesterId);
  if (room.rollsLeft <= 0) throw new Error("더 이상 굴릴 수 없습니다.");

  const fresh = rollDice(5);
  room.dice = room.dice.map((v, i) => (room.held[i] ? v : fresh[i]));
  room.rollsLeft -= 1;
};

/**
 * 주사위 하나의 홀드 여부를 뒤집는다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @param dieIndex - 대상 주사위 인덱스 (0~4)
 */
export const toggleHold = (
  room: RoomState,
  requesterId: string,
  dieIndex: number,
): void => {
  assertTurn(room, requesterId);
  if (room.rollsLeft === 3) throw new Error("먼저 주사위를 굴려주세요.");
  if (dieIndex < 0 || dieIndex > 4) throw new Error("잘못된 주사위입니다.");

  room.held[dieIndex] = !room.held[dieIndex];
};

export interface ScoreResult {
  finished: boolean;
  winnerUserId: string | null;
}

/**
 * 현재 주사위 값을 지정한 항목에 채운다. 다 채우거나 13턴을 다 쓴 사람이
 * 생기면 게임을 종료 처리한다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @param category - 채울 항목
 * @returns 게임 종료 여부와 승자
 */
export const scoreCategory = (
  room: RoomState,
  requesterId: string,
  category: Category,
): ScoreResult => {
  assertTurn(room, requesterId);
  if (room.rollsLeft === 3) throw new Error("먼저 주사위를 굴려주세요.");

  const player = currentPlayer(room);
  const score = calculateScore(category, room.dice);

  // 야찌는 이미 채운 뒤에도(진짜 50점) 다시 5개가 같은 눈이면 또 50점이
  // 쌓인다.
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
  room.dice = [...INITIAL_DICE];
  room.held = [...INITIAL_HELD];
  room.rollsLeft = 3;

  // 야찌는 정확히 13턴제라, 반복 야찌를 쌓는 턴도 턴 수에 포함된다. 그래서
  // 항목이 남은 채로 턴이 끝날 수 있는데, 그런 항목은 0점으로 채워 게임이
  // 멈추지 않게 한다.
  const allDone = room.players.every((p) => p.turnsTaken >= TOTAL_TURNS);

  if (allDone) {
    for (const p of room.players) {
      for (const cat of CATEGORIES) {
        if (p.scorecard[cat] === null) p.scorecard[cat] = 0;
      }
    }
    room.status = "FINISHED";
    let [winner] = room.players;
    for (const p of room.players) {
      if (totalScore(p.scorecard) > totalScore(winner.scorecard)) winner = p;
    }
    room.winnerUserId = winner.userId;
    return { finished: true, winnerUserId: winner.userId };
  }

  room.currentPlayerIndex = (room.currentPlayerIndex + 1) % room.players.length;
  return { finished: false, winnerUserId: null };
};

/**
 * 게임이 진행 중이고, 요청자가 현재 차례인지 확인한다. 아니면 예외를 던진다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 */
const assertTurn = (room: RoomState, requesterId: string): void => {
  if (room.status !== "PLAYING") throw new Error("게임이 진행 중이 아닙니다.");
  if (currentPlayer(room)?.userId !== requesterId) {
    throw new Error("당신의 차례가 아닙니다.");
  }
};

export interface PublicPlayerState {
  userId: string;
  nickname: string;
  seat: number;
  scorecard: Scorecard;
  connected: boolean;
  total: number;
}

export interface PublicRoomState {
  code: string;
  hostId: string;
  maxPlayers: number;
  status: RoomStatus;
  players: PublicPlayerState[];
  dice: number[];
  held: boolean[];
  rollsLeft: number;
  currentPlayerIndex: number;
  currentPlayerId: string | null;
  winnerUserId: string | null;
}

/**
 * 클라이언트로 보낼 수 있는 형태로 방 상태를 가공한다 (총점 계산 포함).
 * @param room - 대상 방
 * @returns 클라이언트용 방 상태
 */
export const publicRoomState = (room: RoomState): PublicRoomState => {
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
};
