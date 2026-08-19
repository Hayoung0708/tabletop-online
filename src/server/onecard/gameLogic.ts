import type { RoomState } from "@/server/roomManager";
import type { Suit } from "@/server/shithead/deck";
import {
  attackValueOf,
  canPlayOneCard,
  createOneCardDeck,
  type OneCard,
} from "@/server/onecard/deck";

/** 2인전 시작 손패 장수. */
const HAND_DEAL_SIZE_2P = 7;
/** 3인 이상 시작 손패 장수. */
const HAND_DEAL_SIZE = 5;
/** 손패가 이 장수 이상이 되면 파산(즉시 탈락). */
const BANKRUPT_HAND_SIZE = 20;
/** "원카드"를 안 외쳤다가 지적당했을 때 먹는 장수. */
const MISSED_CALL_PENALTY = 2;

export interface OneCardGameData {
  type: "ONECARD";
  deck: OneCard[];
  pile: OneCard[];
  currentPlayerIndex: number;
  /** 턴 진행 방향. 1이면 좌석 순서대로, -1이면 역방향(Q 효과). */
  direction: 1 | -1;
  /** 누적된 공격 장수. 반격하지 못하면 이만큼 먹고 0으로 돌아간다. */
  attackStack: number;
  /** 7로 지정된 무늬. 다른 카드가 올라오면 해제(null). */
  declaredSuit: Suit | null;
  winnerUserId: string | null;
  hands: Record<string, OneCard[]>;
  /** 손패를 다 털어 완주한 순서(1등부터). */
  finishedOrder: string[];
  /** 파산으로 탈락한 순서 — 먼저 파산할수록 더 낮은 등수(꼴찌부터). */
  bankruptOrder: string[];
  /** 시작 이후 진행된 수(내기/먹기)의 횟수. 0이면 게임 시작 직후다. */
  movesMade: number;
  /**
   * "원카드"를 외쳐야 하는 플레이어. 손패가 한 장이 된 순간 정해지고, 본인이
   * 외치거나 다른 사람에게 지적당하면(또는 손패가 한 장이 아니게 되면) 풀린다.
   */
  pendingCallPlayerId: string | null;
}

/**
 * 아직 시작하지 않은 원카드 방의 기본 게임 상태를 만든다.
 * @returns 초기 원카드 게임 상태
 */
export const createIdleOneCardGame = (): OneCardGameData => ({
  type: "ONECARD",
  deck: [],
  pile: [],
  currentPlayerIndex: 0,
  direction: 1,
  attackStack: 0,
  declaredSuit: null,
  winnerUserId: null,
  hands: {},
  finishedOrder: [],
  bankruptOrder: [],
  movesMade: 0,
  pendingCallPlayerId: null,
});

/**
 * room.game이 원카드 상태인지 확인하고 좁혀서 반환한다.
 * @param room - 대상 방
 * @returns 원카드 게임 상태
 */
const asOneCardGame = (room: RoomState): OneCardGameData => {
  if (room.game.type !== "ONECARD") throw new Error("원카드 방이 아닙니다.");
  return room.game;
};

/**
 * 카드 배열을 무작위로 섞는다 (Fisher-Yates).
 * @param cards - 섞을 카드 배열
 * @returns 새로 섞인 배열 (원본은 변경하지 않음)
 */
const shuffle = (cards: OneCard[]): OneCard[] => {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * 원카드 게임을 시작한다: 손패를 나눠주고(2인 7장, 3인 이상 5장) 더미에 한
 * 장을 오픈한다. 오픈 카드의 특수효과는 발동하지 않는다. 시작 플레이어는
 * 무작위로 정한다.
 * @param room - 대상 방
 */
export const startOneCardGame = (room: RoomState): void => {
  const deck = shuffle(createOneCardDeck());
  const dealSize = room.players.length === 2 ? HAND_DEAL_SIZE_2P : HAND_DEAL_SIZE;

  const hands: Record<string, OneCard[]> = {};
  for (const p of room.players) {
    hands[p.userId] = deck.splice(0, dealSize);
  }
  const opened = deck.splice(0, 1);

  room.game = {
    type: "ONECARD",
    deck,
    pile: opened,
    currentPlayerIndex: Math.floor(Math.random() * room.players.length),
    direction: 1,
    attackStack: 0,
    declaredSuit: null,
    winnerUserId: null,
    hands,
    finishedOrder: [],
    bankruptOrder: [],
    movesMade: 0,
    pendingCallPlayerId: null,
  };
};

/**
 * 현재 차례인 플레이어의 userId를 반환한다.
 * @param room - 대상 방
 * @param game - 원카드 게임 상태
 * @returns 현재 차례 플레이어의 userId, 없으면 null
 */
const currentPlayerId = (room: RoomState, game: OneCardGameData): string | null =>
  room.players[game.currentPlayerIndex]?.userId ?? null;

/**
 * 이 플레이어가 아직 게임에 남아있는지(완주도 파산도 아님) 확인한다.
 * @param game - 원카드 게임 상태
 * @param userId - 확인할 플레이어
 * @returns 남아있으면 true
 */
const isActive = (game: OneCardGameData, userId: string): boolean =>
  !game.finishedOrder.includes(userId) && !game.bankruptOrder.includes(userId);

/**
 * 게임이 진행 중이고, 요청자가 현재 차례인지 확인한다. 아니면 예외를 던진다.
 * @param room - 대상 방
 * @param game - 원카드 게임 상태
 * @param requesterId - 요청한 게스트 id
 */
const assertTurn = (
  room: RoomState,
  game: OneCardGameData,
  requesterId: string,
): void => {
  if (room.status !== "PLAYING") throw new Error("게임이 진행 중이 아닙니다.");
  if (currentPlayerId(room, game) !== requesterId) {
    throw new Error("당신의 차례가 아닙니다.");
  }
};

/**
 * 진행 방향을 따라, 탈락/완주자를 건너뛰고 active 플레이어 기준 steps칸
 * 이동한 인덱스를 구한다. steps 0이면 그대로(한 번 더).
 * @param room - 대상 방
 * @param game - 원카드 게임 상태
 * @param fromIndex - 기준 인덱스
 * @param steps - active 기준 이동 칸 수 (J 점프는 2)
 * @returns 다음 차례 플레이어의 인덱스
 */
const advanceIndex = (
  room: RoomState,
  game: OneCardGameData,
  fromIndex: number,
  steps: number,
): number => {
  let index = fromIndex;
  for (let moved = 0; moved < steps; moved++) {
    for (let hop = 1; hop <= room.players.length; hop++) {
      const next =
        (index + game.direction * hop + room.players.length * hop) % room.players.length;
      if (isActive(game, room.players[next].userId)) {
        index = next;
        break;
      }
    }
  }
  return index;
};

/**
 * 남은 active 인원이 1명 이하면 게임을 끝낸다: 마지막 남은 사람을
 * finishedOrder 끝에 붙여 등수를 확정한다.
 * @param room - 대상 방
 * @param game - 원카드 게임 상태
 * @returns 게임이 끝났으면 true
 */
const settleIfGameOver = (room: RoomState, game: OneCardGameData): boolean => {
  const active = room.players.filter((p) => isActive(game, p.userId));
  if (active.length > 1) return false;
  if (active.length === 1) game.finishedOrder.push(active[0].userId);
  game.winnerUserId = game.finishedOrder[0] ?? null;
  return true;
};

export interface OneCardPlayResult {
  /** 이번에 낸 카드 (애니메이션용). */
  played: OneCard;
  /** 이 플레이로 손패를 다 털었는지. */
  finished: boolean;
  gameOver: boolean;
}

/**
 * 낸 카드의 특수 효과(공격 누적, 무늬 지정, 방향 전환)를 적용하고,
 * 다음 차례까지 건너뛸 칸 수를 돌려준다.
 * @param game - 원카드 게임 상태
 * @param card - 방금 낸 카드
 * @param declaredSuit - 7로 지정한 무늬
 * @param finished - 이 플레이로 손패를 다 털었는지
 * @returns 다음 차례를 정할 때 이동할 칸 수
 */
const applyCardEffect = (
  game: OneCardGameData,
  card: OneCard,
  declaredSuit: Suit | undefined,
  finished: boolean,
): number => {
  game.attackStack += attackValueOf(card.rank);
  game.declaredSuit = card.rank === "7" ? (declaredSuit as Suit) : null;
  if (card.rank === "Q") game.direction = game.direction === 1 ? -1 : 1;

  // K는 한 번 더(0칸), J는 다음 사람 건너뜀(2칸). 완주했으면 한 번 더는
  // 의미가 없으므로 그냥 다음 사람에게 넘긴다.
  if (card.rank === "K" && !finished) return 0;
  return card.rank === "J" ? 2 : 1;
};

/**
 * 손패에서 카드 한 장을 낸다. 특수 카드 효과까지 처리하고 다음 차례를 정한다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @param cardId - 내려는 카드 id
 * @param declaredSuit - 7을 낼 때 지정할 무늬 (7이 아니면 무시)
 * @returns 완주/게임종료 여부와 낸 카드
 */
export const playOneCard = (
  room: RoomState,
  requesterId: string,
  cardId: string,
  declaredSuit?: Suit,
): OneCardPlayResult => {
  const game = asOneCardGame(room);
  assertTurn(room, game, requesterId);

  const hand = game.hands[requesterId];
  const played = hand.find((c) => c.id === cardId);
  if (!played) throw new Error("가지고 있지 않은 카드입니다.");

  const top = game.pile[game.pile.length - 1];
  if (!top || !canPlayOneCard(top, played, game.declaredSuit, game.attackStack)) {
    throw new Error("낼 수 없는 카드입니다.");
  }
  if (played.rank === "7" && !declaredSuit) {
    throw new Error("바꿀 무늬를 선택해주세요.");
  }

  hand.splice(hand.indexOf(played), 1);
  game.pile.push(played);
  game.movesMade += 1;

  const finished = hand.length === 0;
  if (finished) game.finishedOrder.push(requesterId);
  syncPendingCall(game, requesterId);

  const steps = applyCardEffect(game, played, declaredSuit, finished);

  if (settleIfGameOver(room, game)) {
    return { played, finished, gameOver: true };
  }

  game.currentPlayerIndex = advanceIndex(room, game, game.currentPlayerIndex, steps);

  return { played, finished, gameOver: false };
};

export interface OneCardDrawResult {
  /** 실제로 먹은 장수 (애니메이션용). */
  drawn: number;
  /** 이번 드로우로 파산(탈락)했는지. */
  bankrupt: boolean;
  gameOver: boolean;
}

/**
 * 덱이 부족하면 더미(맨 위 한 장 제외)를 섞어 덱을 다시 채운다.
 * @param game - 원카드 게임 상태
 */
const replenishDeck = (game: OneCardGameData): void => {
  if (game.deck.length > 0 || game.pile.length <= 1) return;
  const top = game.pile.pop() as OneCard;
  game.deck = shuffle(game.pile);
  game.pile = [top];
};

/**
 * 덱에서 카드를 뽑아 손패 앞쪽(화면 왼쪽)에 넣는다. 덱이 비면 더미를 섞어
 * 다시 채우고, 그래도 뽑을 카드가 없으면 뽑은 만큼만 넣는다.
 * @param game - 원카드 게임 상태
 * @param hand - 카드를 받을 손패
 * @param count - 뽑으려는 장수
 * @returns 실제로 뽑은 장수
 */
const drawIntoHand = (game: OneCardGameData, hand: OneCard[], count: number): number => {
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    replenishDeck(game);
    const card = game.deck.pop();
    if (!card) break;
    hand.unshift(card);
    drawn += 1;
  }
  return drawn;
};

/**
 * 손패 장수에 맞춰 "원카드" 외치기 상태를 갱신한다. 한 장이 되면 그 사람이
 * 외칠 차례가 되고, 한 장이 아니게 되면 걸려 있던 외치기가 풀린다.
 * 슬롯이 하나라 여러 명이 한 장인 경우 가장 최근 사람만 대상이 된다 —
 * 지적 버튼도 하나뿐이라 화면과 규칙을 일치시키는 쪽을 택했다.
 * @param game - 원카드 게임 상태
 * @param playerId - 방금 수를 둔 플레이어
 */
const syncPendingCall = (game: OneCardGameData, playerId: string): void => {
  if (game.hands[playerId].length === 1) {
    game.pendingCallPlayerId = playerId;
    return;
  }
  if (game.pendingCallPlayerId === playerId) game.pendingCallPlayerId = null;
};

/**
 * 카드를 먹는다: 공격이 쌓여 있으면 그만큼, 아니면 한 장. 먹은 뒤 손패가
 * 상한(20장) 이상이면 파산으로 즉시 탈락하고, 손패는 덱에 섞어 되돌린다.
 * 먹으면(또는 파산하면) 차례가 넘어간다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @returns 먹은 장수와 파산/게임종료 여부
 */
export const drawOneCards = (room: RoomState, requesterId: string): OneCardDrawResult => {
  const game = asOneCardGame(room);
  assertTurn(room, game, requesterId);

  const count = game.attackStack > 0 ? game.attackStack : 1;
  game.attackStack = 0;
  game.movesMade += 1;

  const hand = game.hands[requesterId];
  const drawn = drawIntoHand(game, hand, count);
  syncPendingCall(game, requesterId);

  const bankrupt = hand.length >= BANKRUPT_HAND_SIZE;
  if (bankrupt) {
    game.bankruptOrder.push(requesterId);
    // 파산자의 손패는 덱 아래에 섞어 되돌려 카드가 마르지 않게 한다.
    game.deck = shuffle([...hand, ...game.deck]);
    game.hands[requesterId] = [];
  }

  if (settleIfGameOver(room, game)) {
    return { drawn, bankrupt, gameOver: true };
  }

  game.currentPlayerIndex = advanceIndex(room, game, game.currentPlayerIndex, 1);
  return { drawn, bankrupt, gameOver: false };
};

/**
 * 당사자가 "원카드"를 외쳤다 — 벌칙 없이 외치기를 끝낸다.
 * @param room - 대상 방
 * @param requesterId - 외친 게스트 id
 * @returns 실제로 외칠 차례였으면 true
 */
export const callOneCard = (room: RoomState, requesterId: string): boolean => {
  const game = asOneCardGame(room);
  if (game.pendingCallPlayerId !== requesterId) return false;
  game.pendingCallPlayerId = null;
  return true;
};

/**
 * 외치기를 놓친 것을 다른 사람이 지적했다 — 벌칙으로 카드를 먹인다. 차례는
 * 그대로 두고 손패만 늘린다(한 장 남은 사람이 두 장을 더 먹는 것뿐이라
 * 파산 상한 20장에는 닿을 수 없다).
 * @param room - 대상 방
 * @param targetId - 외쳤어야 하는 게스트 id
 * @returns 벌칙으로 먹은 장수, 이미 해결된 외치기면 null
 */
export const penalizeMissedOneCardCall = (
  room: RoomState,
  targetId: string,
): number | null => {
  const game = asOneCardGame(room);
  if (game.pendingCallPlayerId !== targetId) return null;
  game.pendingCallPlayerId = null;
  return drawIntoHand(game, game.hands[targetId], MISSED_CALL_PENALTY);
};

/**
 * 게임 종료 연출이 끝난 뒤, 방 상태를 FINISHED로 바꿔 결과 화면으로 넘긴다.
 * @param room - 대상 방
 */
export const finalizeOneCardGameOver = (room: RoomState): void => {
  asOneCardGame(room);
  room.status = "FINISHED";
};

/**
 * 이 플레이어의 최종 등수를 구한다. 완주자는 완주 순서대로 앞 등수,
 * 파산자는 먼저 파산할수록 뒤 등수(꼴찌부터)를 받는다.
 * @param room - 대상 방
 * @param game - 원카드 게임 상태
 * @param userId - 확인할 플레이어
 * @returns 등수(1부터), 아직 확정되지 않았으면 null
 */
const rankOf = (
  room: RoomState,
  game: OneCardGameData,
  userId: string,
): number | null => {
  const finishedIdx = game.finishedOrder.indexOf(userId);
  if (finishedIdx !== -1) return finishedIdx + 1;
  const bankruptIdx = game.bankruptOrder.indexOf(userId);
  if (bankruptIdx !== -1) return room.players.length - bankruptIdx;
  return null;
};

/**
 * 결과 저장용으로 플레이어의 등수를 계산한다 (게임 종료 후 호출).
 * @param room - 대상 방
 * @param userId - 대상 플레이어
 * @returns 등수(1부터), 없으면 room 인원수
 */
export const oneCardRankOf = (room: RoomState, userId: string): number => {
  const game = asOneCardGame(room);
  return rankOf(room, game, userId) ?? room.players.length;
};

export interface LastPlayerStandingResult {
  winnerUserId: string;
  removedPlayerIds: string[];
}

/**
 * 게임 진행 중 한 명만 남고 모두 연결이 끊겼으면 그 한 명을 승자로 처리하고
 * 방을 새 대기방 상태로 되돌린다.
 * @param room - 대상 방
 * @returns 승자와 제거된 플레이어 목록, 해당 없으면 null
 */
export const checkOneCardLastPlayerStanding = (
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
  room.game = createIdleOneCardGame();
  room.game.winnerUserId = winner.userId;
  room.hostId = winner.userId;

  return { winnerUserId: winner.userId, removedPlayerIds };
};

export interface PublicOneCardPlayer {
  userId: string;
  handCount: number;
  hand: OneCard[] | null;
  finishRank: number | null;
  /** 파산으로 탈락했는지 (등수표에 표시용). */
  bankrupt: boolean;
}

export interface PublicOneCardGameState {
  type: "ONECARD";
  pile: OneCard[];
  deckCount: number;
  currentPlayerId: string | null;
  direction: 1 | -1;
  attackStack: number;
  declaredSuit: Suit | null;
  winnerUserId: string | null;
  /** 시작 이후 진행된 수의 횟수 — 0이면 클라이언트가 딜 연출을 재생한다. */
  movesMade: number;
  /** "원카드"를 외쳐야 하는 플레이어. null이 아니면 모두에게 외치기 버튼이 뜬다. */
  pendingCallPlayerId: string | null;
  players: PublicOneCardPlayer[];
}

/**
 * 클라이언트로 보낼 수 있는 형태로 원카드 게임 상태를 가공한다. 보는 사람
 * 본인의 손패만 실제 값을 보내고, 나머지는 개수만 보낸다.
 * @param room - 대상 방
 * @param forUserId - 이 상태를 받을 플레이어
 * @returns 클라이언트용 원카드 게임 상태
 */
export const publicOneCardGameState = (
  room: RoomState,
  forUserId: string,
): PublicOneCardGameState => {
  const game = asOneCardGame(room);

  return {
    type: "ONECARD",
    pile: game.pile,
    deckCount: game.deck.length,
    currentPlayerId: currentPlayerId(room, game),
    direction: game.direction,
    attackStack: game.attackStack,
    declaredSuit: game.declaredSuit,
    winnerUserId: game.winnerUserId,
    movesMade: game.movesMade,
    pendingCallPlayerId: game.pendingCallPlayerId,
    players: room.players.map((p) => ({
      userId: p.userId,
      handCount: game.hands[p.userId]?.length ?? 0,
      hand: p.userId === forUserId ? (game.hands[p.userId] ?? []) : null,
      finishRank: rankOf(room, game, p.userId),
      bankrupt: game.bankruptOrder.includes(p.userId),
    })),
  };
};
