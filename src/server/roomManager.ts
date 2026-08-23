import { ROOM_NAME_MAX_LENGTH } from "@/constants/app";
import type { PublicYatzyGameState, YatzyGameData } from "@/server/yatzy/gameLogic";
import type {
  PublicShitheadGameState,
  ShitheadGameData,
} from "@/server/shithead/gameLogic";
import type { OneCardGameData, PublicOneCardGameState } from "@/server/onecard/gameLogic";
import type { HulaGameData, PublicHulaGameState } from "@/server/hula/gameLogic";

const MIN_PLAYERS_TO_START = 2;

export type GameData = YatzyGameData | ShitheadGameData | OneCardGameData | HulaGameData;
export type PublicGameState =
  | PublicYatzyGameState
  | PublicShitheadGameState
  | PublicOneCardGameState
  | PublicHulaGameState;

export interface PlayerState {
  userId: string;
  nickname: string;
  seat: number;
  connected: boolean;
  /** 이 방에서 1등한 횟수. 게임 종류를 바꿔도 이어지고, 방을 옮기면 0부터 센다. */
  wins: number;
}

export type RoomStatus = "WAITING" | "PLAYING" | "FINISHED";

export interface RoomState {
  dbId: string;
  code: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  /** 싯헤드 전용 — 조커 2장을 넣은 54장 덱으로 할지. 6인은 이 모드여야 한다. */
  useJokers: boolean;
  /**
   * 방에 접속한 사람이 아무도 없어진 시각(ms). 잠깐 끊긴 것과 진짜로 버려진
   * 방을 구분하려고 둔다 — 비자마자 지우면 방장이 잠깐 끊긴 사이에 방이
   * 사라져서 초대받은 사람들이 "없는 방"을 보게 된다.
   */
  emptySince: number | null;
  /** 이번 판의 승수를 이미 올렸는지. 결과 저장이 두 번 돌아도 중복으로 세지 않는다. */
  winAwarded: boolean;
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
 * 지금 메모리에 살아 있는 방을 모두 돌려준다 (버려진 방 청소용).
 * @returns 방 상태 목록
 */
export const listRooms = (): RoomState[] => {
  return [...rooms.values()];
};

/**
 * 인메모리 방 상태를 가져오거나, 없으면 새로 만든다. 게임별 초기 상태는
 * 호출하는 쪽(게임 디스패치)에서 만들어 넘겨준다 — roomManager는 어떤
 * 게임인지 몰라도 되게 하기 위함.
 * @param dbId - DB상의 방 id
 * @param code - 방 코드
 * @param name - 방 제목
 * @param hostId - 방장 게스트 id
 * @param maxPlayers - 최대 인원
 * @param idleGame - 이 방의 게임 종류에 맞는 초기 게임 상태
 * @param useJokers - 싯헤드 조커(54장) 모드 여부
 * @returns 방 상태
 */
export const createOrGetRoom = (
  dbId: string,
  code: string,
  name: string,
  hostId: string,
  maxPlayers: number,
  idleGame: GameData,
  useJokers: boolean,
): RoomState => {
  const existing = rooms.get(code);
  if (existing) return existing;

  const room: RoomState = {
    dbId,
    code,
    name,
    hostId,
    maxPlayers,
    useJokers,
    winAwarded: false,
    emptySince: null,
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
 * @param wins - 이 방에서 쌓은 승수
 * @returns 등록되거나 갱신된 플레이어
 */
export const addPlayer = (
  room: RoomState,
  userId: string,
  nickname: string,
  wins: number,
): PlayerState => {
  room.emptySince = null;

  const existing = room.players.find((p) => p.userId === userId);
  if (existing) {
    existing.connected = true;
    existing.nickname = nickname;
    existing.wins = wins;
    return existing;
  }

  // room.players.length는 마지막에 앉은 사람이 아닌 다른 사람이 남아있는
  // 상태에서 나가면 좌석과 충돌한다. 항상 가장 큰 좌석번호+1을 써야 한다.
  const nextSeat = room.players.reduce((max, p) => Math.max(max, p.seat), -1) + 1;

  const player: PlayerState = { userId, nickname, seat: nextSeat, connected: true, wins };
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
  if (connected) room.emptySince = null;
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
 * @param maxStartPlayers
 */
export const assertCanStartGame = (
  room: RoomState,
  requesterId: string,
  maxStartPlayers?: number,
): void => {
  if (room.hostId !== requesterId) throw new Error("호스트만 시작할 수 있습니다.");
  // 게임이 끝난 뒤(FINISHED)에는 대기 화면과 같은 카드에서 곧바로 다시
  // 시작할 수 있어야 하므로, 진행 중(PLAYING)일 때만 막는다.
  if (room.status === "PLAYING") throw new Error("이미 시작된 게임입니다.");
  // 연결이 끊긴 채로 남아있는 사람이 인원수를 부풀려 시작 가능한 것처럼
  // 보이면 안 되므로 먼저 정리한다.
  removeDisconnectedPlayers(room);
  if (room.players.length < MIN_PLAYERS_TO_START)
    throw new Error("최소 2명이 필요합니다.");
  // 게임별 시작 인원 상한(예: 싯헤드는 덱 한계로 5명). 방 정원과는 별개다.
  if (maxStartPlayers !== undefined && room.players.length > maxStartPlayers)
    throw new Error(`이 게임은 최대 ${maxStartPlayers}명까지 시작할 수 있습니다.`);

  room.status = "PLAYING";
  room.winAwarded = false;
};

/**
 * 대기 중에 방장이 방 제목과 게임 종류를 바꾼다. 게임별 초기 상태는 호출하는
 * 쪽(게임 디스패치)에서 만들어 넘겨준다 — roomManager는 게임을 몰라도 되게 한다.
 * @param room - 대상 방
 * @param requesterId - 변경을 요청한 게스트 id
 * @param name - 새 방 제목
 * @param idleGame - 새 게임 종류의 초기 상태
 * @param useJokers - 싯헤드 조커(54장) 모드 여부
 */
export const updateRoomSettings = (
  room: RoomState,
  requesterId: string,
  name: string,
  idleGame: GameData,
  useJokers: boolean,
): void => {
  if (room.hostId !== requesterId) throw new Error("호스트만 변경할 수 있습니다.");
  if (room.status === "PLAYING") throw new Error("게임 중에는 변경할 수 없습니다.");

  const trimmed = name.trim();
  if (trimmed.length === 0) throw new Error("방 제목을 입력해주세요.");
  if (trimmed.length > ROOM_NAME_MAX_LENGTH) throw new Error("방 제목이 너무 깁니다.");

  room.name = trimmed;
  room.game = idleGame;
  room.useJokers = useJokers;
  // 게임이 끝난 뒤(FINISHED) 설정을 바꿨으면 새 게임은 비어있는 초기
  // 상태이므로, 대기 화면으로 돌아가야 등수표 같은 낡은 화면이 안 남는다.
  room.status = "WAITING";
};

export interface PublicPlayerState {
  userId: string;
  nickname: string;
  seat: number;
  connected: boolean;
  /** 이 방에서 쌓은 승수. 방을 옮기면 0부터 다시 센다. */
  wins: number;
}

export interface PublicRoomState {
  code: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  /** 싯헤드 조커(54장) 모드 여부. */
  useJokers: boolean;
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
    name: room.name,
    hostId: room.hostId,
    maxPlayers: room.maxPlayers,
    useJokers: room.useJokers,
    status: room.status,
    players: room.players.map((p) => ({
      userId: p.userId,
      nickname: p.nickname,
      wins: p.wins,
      seat: p.seat,
      connected: p.connected,
    })),
    game,
  };
};
