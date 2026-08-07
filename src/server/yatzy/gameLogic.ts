import {
  CATEGORIES,
  type Category,
  type Scorecard,
  calculateScore,
  emptyScorecard,
  rollDice,
  totalScore,
} from "@/utils/yatzy";
import type { RoomState } from "@/server/roomManager";

const TOTAL_TURNS = CATEGORIES.length;
const INITIAL_DICE = [1, 1, 1, 1, 1];
const INITIAL_HELD = [false, false, false, false, false];

export interface YatzyGameData {
  type: "YATZY";
  dice: number[];
  held: boolean[];
  rollsLeft: number;
  currentPlayerIndex: number;
  winnerUserId: string | null;
  scorecards: Record<string, Scorecard>;
  turnsTaken: Record<string, number>;
}

/**
 * 아직 시작하지 않은 야찌 방의 기본 게임 상태를 만든다.
 * @returns 초기 야찌 게임 상태
 */
export const createIdleYatzyGame = (): YatzyGameData => ({
  type: "YATZY",
  dice: [...INITIAL_DICE],
  held: [...INITIAL_HELD],
  rollsLeft: 3,
  currentPlayerIndex: 0,
  winnerUserId: null,
  scorecards: {},
  turnsTaken: {},
});

/**
 * 야찌 게임을 시작한다. 방 공통 시작 조건(호스트/인원수 등)은 roomManager의
 * assertCanStart가 이미 확인했다는 전제.
 * @param room - 대상 방
 */
export const startYatzyGame = (room: RoomState): void => {
  const scorecards: Record<string, Scorecard> = {};
  const turnsTaken: Record<string, number> = {};
  for (const p of room.players) {
    scorecards[p.userId] = emptyScorecard();
    turnsTaken[p.userId] = 0;
  }

  room.game = {
    type: "YATZY",
    dice: [...INITIAL_DICE],
    held: [...INITIAL_HELD],
    rollsLeft: 3,
    currentPlayerIndex: 0,
    winnerUserId: null,
    scorecards,
    turnsTaken,
  };
};

/**
 * room.game이 야찌 상태인지 확인하고 좁혀서 반환한다.
 * @param room - 대상 방
 * @returns 야찌 게임 상태
 */
const asYatzyGame = (room: RoomState): YatzyGameData => {
  if (room.game.type !== "YATZY") throw new Error("야찌 방이 아닙니다.");
  return room.game;
};

/**
 * 현재 차례인 플레이어의 userId를 반환한다.
 * @param room - 대상 방
 * @returns 현재 차례 플레이어의 userId, 없으면 null
 */
const currentPlayerId = (room: RoomState): string | null => {
  const game = asYatzyGame(room);
  return room.players[game.currentPlayerIndex]?.userId ?? null;
};

/**
 * 게임이 진행 중이고, 요청자가 현재 차례인지 확인한다. 아니면 예외를 던진다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 */
const assertTurn = (room: RoomState, requesterId: string): void => {
  if (room.status !== "PLAYING") throw new Error("게임이 진행 중이 아닙니다.");
  if (currentPlayerId(room) !== requesterId) {
    throw new Error("당신의 차례가 아닙니다.");
  }
};

/**
 * 주사위를 굴린다. 홀드된 주사위는 그대로 두고 나머지만 다시 굴린다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 */
export const rollDiceForRoom = (room: RoomState, requesterId: string): void => {
  assertTurn(room, requesterId);
  const game = asYatzyGame(room);
  if (game.rollsLeft <= 0) throw new Error("더 이상 굴릴 수 없습니다.");

  const fresh = rollDice(5);
  game.dice = game.dice.map((v, i) => (game.held[i] ? v : fresh[i]));
  game.rollsLeft -= 1;
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
  const game = asYatzyGame(room);
  if (game.rollsLeft === 3) throw new Error("먼저 주사위를 굴려주세요.");
  if (dieIndex < 0 || dieIndex > 4) throw new Error("잘못된 주사위입니다.");

  game.held[dieIndex] = !game.held[dieIndex];
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
  const game = asYatzyGame(room);
  if (game.rollsLeft === 3) throw new Error("먼저 주사위를 굴려주세요.");

  const scorecard = game.scorecards[requesterId];
  const score = calculateScore(category, game.dice);

  // 야찌는 이미 채운 뒤에도(진짜 50점) 다시 5개가 같은 눈이면 또 50점이 쌓인다.
  if (category === "yahtzee" && scorecard.yahtzee) {
    if (score === 0) throw new Error("이미 채운 항목입니다.");
    scorecard.yahtzee += score;
  } else {
    if (scorecard[category] !== null) {
      throw new Error("이미 채운 항목입니다.");
    }
    scorecard[category] = score;
  }

  game.turnsTaken[requesterId] += 1;
  game.dice = [...INITIAL_DICE];
  game.held = [...INITIAL_HELD];
  game.rollsLeft = 3;

  // 야찌는 정확히 13턴제라, 반복 야찌를 쌓는 턴도 턴 수에 포함된다. 그래서
  // 항목이 남은 채로 턴이 끝날 수 있는데, 그런 항목은 0점으로 채워 게임이
  // 멈추지 않게 한다.
  const allDone = room.players.every((p) => game.turnsTaken[p.userId] >= TOTAL_TURNS);

  if (allDone) {
    for (const p of room.players) {
      const cards = game.scorecards[p.userId];
      for (const cat of CATEGORIES) {
        if (cards[cat] === null) cards[cat] = 0;
      }
    }
    room.status = "FINISHED";
    let [winner] = room.players;
    for (const p of room.players) {
      if (
        totalScore(game.scorecards[p.userId]) > totalScore(game.scorecards[winner.userId])
      ) {
        winner = p;
      }
    }
    game.winnerUserId = winner.userId;
    return { finished: true, winnerUserId: winner.userId };
  }

  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % room.players.length;
  return { finished: false, winnerUserId: null };
};

export interface LastPlayerStandingResult {
  winnerUserId: string;
  removedPlayerIds: string[];
}

/**
 * 게임 진행 중 한 명만 남고 모두 연결이 끊겼으면 그 한 명을 승자로 처리하고
 * 방을 새 대기방 상태로 되돌린다 (일반 종료 화면 대신).
 * @param room - 대상 방
 * @returns 승자와 제거된 플레이어 목록, 해당 없으면 null
 */
export const checkYatzyLastPlayerStanding = (
  room: RoomState,
): LastPlayerStandingResult | null => {
  if (room.status !== "PLAYING") return null;

  const connected = room.players.filter((p) => p.connected);
  if (connected.length !== 1) return null;

  const [winner] = connected;
  const removedPlayerIds = room.players
    .filter((p) => p.userId !== winner.userId)
    .map((p) => p.userId);

  room.players = [{ ...winner, seat: 0 }];
  room.status = "WAITING";
  room.game = createIdleYatzyGame();
  room.game.winnerUserId = winner.userId;
  room.hostId = winner.userId;

  return { winnerUserId: winner.userId, removedPlayerIds };
};

export interface PublicYatzyGameState {
  type: "YATZY";
  dice: number[];
  held: boolean[];
  rollsLeft: number;
  currentPlayerId: string | null;
  winnerUserId: string | null;
  scorecards: Record<string, Scorecard>;
  totals: Record<string, number>;
}

/**
 * 클라이언트로 보낼 수 있는 형태로 야찌 게임 상태를 가공한다 (총점 계산 포함).
 * 야찌는 모두에게 같은 정보를 보여주므로 보는 사람(forUserId)에 따라 달라지지 않는다.
 * @param room - 대상 방
 * @returns 클라이언트용 야찌 게임 상태
 */
export const publicYatzyGameState = (room: RoomState): PublicYatzyGameState => {
  const game = asYatzyGame(room);
  const totals: Record<string, number> = {};
  for (const p of room.players) {
    totals[p.userId] = totalScore(game.scorecards[p.userId] ?? emptyScorecard());
  }

  return {
    type: "YATZY",
    dice: game.dice,
    held: game.held,
    rollsLeft: game.rollsLeft,
    currentPlayerId: currentPlayerId(room),
    winnerUserId: game.winnerUserId,
    scorecards: game.scorecards,
    totals,
  };
};
