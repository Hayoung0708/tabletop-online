import {
  type GameData,
  type PublicGameState,
  type RoomState,
  publicRoomState,
  type PublicRoomState,
} from "@/server/roomManager";
import {
  checkYatzyLastPlayerStanding,
  createIdleYatzyGame,
  publicYatzyGameState,
  startYatzyGame,
  type LastPlayerStandingResult,
} from "@/server/yatzy/gameLogic";
import {
  checkShitheadLastPlayerStanding,
  createIdleShitheadGame,
  publicShitheadGameState,
  startShitheadGame,
} from "@/server/shithead/gameLogic";
import {
  checkOneCardLastPlayerStanding,
  createIdleOneCardGame,
  publicOneCardGameState,
  startOneCardGame,
} from "@/server/onecard/gameLogic";
import {
  checkHulaLastPlayerStanding,
  createIdleHulaGame,
  publicHulaGameState,
  startHulaGame,
} from "@/server/hula/gameLogic";

/**
 * gameType 문자열에 맞는, 아직 시작하지 않은 게임 상태를 만든다.
 * @param gameType - DB에 저장된 게임 종류 문자열
 * @returns 초기 게임 상태
 */
export const createIdleGame = (gameType: string): GameData => {
  if (gameType === "SHITHEAD") return createIdleShitheadGame();
  if (gameType === "ONECARD") return createIdleOneCardGame();
  if (gameType === "HULA") return createIdleHulaGame();
  return createIdleYatzyGame();
};

/**
 * 방의 게임 종류에 맞게 실제 게임을 시작한다 (카드/주사위 초기화 등).
 * @param room - 대상 방 (assertCanStartGame을 이미 통과한 상태)
 */
export const startGameData = (room: RoomState): void => {
  if (room.game.type === "SHITHEAD") {
    startShitheadGame(room);
    return;
  }
  if (room.game.type === "ONECARD") {
    startOneCardGame(room);
    return;
  }
  if (room.game.type === "HULA") {
    startHulaGame(room);
    return;
  }
  startYatzyGame(room);
};

/**
 * 게임 종류에 맞는 공개 게임 상태를 만든다.
 * @param room - 대상 방
 * @param forUserId - 이 상태를 받을 플레이어
 * @returns 클라이언트용 게임 상태
 */
const buildPublicGameState = (room: RoomState, forUserId: string): PublicGameState => {
  if (room.game.type === "SHITHEAD") return publicShitheadGameState(room, forUserId);
  if (room.game.type === "ONECARD") return publicOneCardGameState(room, forUserId);
  if (room.game.type === "HULA") return publicHulaGameState(room, forUserId);
  return publicYatzyGameState(room);
};

/**
 * 클라이언트에게 보낼 방 상태 전체를 조립한다. 게임 종류에 따라 보는
 * 사람(forUserId)마다 내용이 달라질 수 있어(싯헤드 손패) 소켓별로 호출해야 한다.
 * @param room - 대상 방
 * @param forUserId - 이 상태를 받을 플레이어
 * @returns 클라이언트용 방 상태
 */
export const buildPublicRoomState = (
  room: RoomState,
  forUserId: string,
): PublicRoomState => {
  const game: PublicGameState = buildPublicGameState(room, forUserId);
  return publicRoomState(room, game);
};

/**
 * 게임 진행 중 한 명만 남았을 때의 처리를 게임 종류에 맞게 위임한다.
 * @param room - 대상 방
 * @returns 승자와 제거된 플레이어 목록, 해당 없으면 null
 */
export const checkLastPlayerStanding = (
  room: RoomState,
): LastPlayerStandingResult | null => {
  if (room.game.type === "SHITHEAD") return checkShitheadLastPlayerStanding(room);
  if (room.game.type === "ONECARD") return checkOneCardLastPlayerStanding(room);
  if (room.game.type === "HULA") return checkHulaLastPlayerStanding(room);
  return checkYatzyLastPlayerStanding(room);
};
