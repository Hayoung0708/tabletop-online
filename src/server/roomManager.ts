import type { PublicYatzyGameState, YatzyGameData } from "@/server/yatzy/gameLogic";
import type {
  PublicShitheadGameState,
  ShitheadGameData,
} from "@/server/shithead/gameLogic";

const MIN_PLAYERS_TO_START = 2;

export type GameData = YatzyGameData | ShitheadGameData;
export type PublicGameState = PublicYatzyGameState | PublicShitheadGameState;

export interface PlayerState {
  userId: string;
  nickname: string;
  seat: number;
  connected: boolean;
}

export type RoomStatus = "WAITING" | "PLAYING" | "FINISHED";

export interface RoomState {
  dbId: string;
  code: string;
  hostId: string;
  maxPlayers: number;
  status: RoomStatus;
  players: PlayerState[];
  game: GameData;
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
 * 인메모리 방 상태를 가져오거나, 없으면 새로 만든다. 게임별 초기 상태는
 * 호출하는 쪽(게임 디스패치)에서 만들어 넘겨준다 — roomManager는 어떤
 * 게임인지 몰라도 되게 하기 위함.
 * @param dbId - DB상의 방 id
 * @param code - 방 코드
 * @param hostId - 방장 게스트 id
 * @param maxPlayers - 최대 인원
 * @param idleGame - 이 방의 게임 종류에 맞는 초기 게임 상태
 * @returns 방 상태
 */
export const createOrGetRoom = (
  dbId: string,
  code: string,
  hostId: string,
  maxPlayers: number,
  idleGame: GameData,
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
    game: idleGame,
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

  const player: PlayerState = { userId, nickname, seat: nextSeat, connected: true };
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
 * 게임 시작 공통 조건(방장인지, 대기 중인지, 최소 인원)을 확인하고 방
 * 상태를 PLAYING으로 바꾼다. 게임별 카드/주사위 초기화는 각 게임의
 * startXGame이 뒤이어 처리한다.
 * @param room - 대상 방
 * @param requesterId - 시작을 요청한 게스트 id
 */
export const assertCanStartGame = (room: RoomState, requesterId: string): void => {
  if (room.hostId !== requesterId) throw new Error("호스트만 시작할 수 있습니다.");
  if (room.status !== "WAITING") throw new Error("이미 시작된 게임입니다.");
  // 연결이 끊긴 채로 남아있는 사람이 인원수를 부풀려 시작 가능한 것처럼
  // 보이면 안 되므로 먼저 정리한다.
  removeDisconnectedPlayers(room);
  if (room.players.length < MIN_PLAYERS_TO_START)
    throw new Error("최소 2명이 필요합니다.");

  room.status = "PLAYING";
};

export interface PublicPlayerState {
  userId: string;
  nickname: string;
  seat: number;
  connected: boolean;
}

export interface PublicRoomState {
  code: string;
  hostId: string;
  maxPlayers: number;
  status: RoomStatus;
  players: PublicPlayerState[];
  game: PublicGameState;
}

/**
 * 클라이언트로 보낼 수 있는 형태로 방 공통 정보를 가공한다. 게임별 상태는
 * 호출하는 쪽(게임 디스패치)이 채워 넣는다.
 * @param room - 대상 방
 * @param game - 이미 만들어진 게임별 공개 상태
 * @returns 클라이언트용 방 상태
 */
export const publicRoomState = (
  room: RoomState,
  game: PublicGameState,
): PublicRoomState => {
  return {
    code: room.code,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    status: room.status,
    players: room.players.map((p) => ({
      userId: p.userId,
      nickname: p.nickname,
      seat: p.seat,
      connected: p.connected,
    })),
    game,
  };
};
