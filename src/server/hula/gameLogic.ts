import type { RoomState } from "@/server/roomManager";
import {
  createHulaDeck,
  hulaHandPoints,
  sortHulaHand,
  type HulaCard,
} from "@/server/hula/deck";
import {
  canAppendToMeld,
  classifyMeld,
  sortMeldCards,
  withAppendedCard,
  SET_COMPLETE_SIZE,
  type HulaMeld,
} from "@/server/hula/meld";

/** 시작 손패 장수. */
const HAND_DEAL_SIZE = 7;

/** 카드를 가져올 수 있는 곳. */
export type HulaDrawSource = "deck" | "discard";

export interface HulaGameData {
  type: "HULA";
  deck: HulaCard[];
  /** 더미. 배열 맨 뒤가 맨 위 카드다. */
  discard: HulaCard[];
  hands: Record<string, HulaCard[]>;
  /** 바닥에 등록된 조합들. 등록한 사람(ownerId)이 붙어 있다. */
  melds: HulaMeld[];
  currentPlayerIndex: number;
  /** 이번 차례에 카드를 가져왔는지. 가져와야 등록·붙이기·버리기를 할 수 있다. */
  hasDrawn: boolean;
  winnerUserId: string | null;
  /** 종료 시 확정되는 플레이어별 벌점. 진행 중에는 null. */
  scores: Record<string, number> | null;
  /** 시작 이후 진행된 수의 횟수. 0이면 게임 시작 직후다. */
  movesMade: number;
}

/** 조합 id를 만들 때 쓰는 일련번호. */
let meldIdSeq = 0;

/**
 * 아직 시작하지 않은 훌라 방의 기본 게임 상태를 만든다.
 * @returns 초기 훌라 게임 상태
 */
export const createIdleHulaGame = (): HulaGameData => ({
  type: "HULA",
  deck: [],
  discard: [],
  hands: {},
  melds: [],
  currentPlayerIndex: 0,
  hasDrawn: false,
  winnerUserId: null,
  scores: null,
  movesMade: 0,
});

/**
 * room.game이 훌라 상태인지 확인하고 좁혀서 반환한다.
 * @param room - 대상 방
 * @returns 훌라 게임 상태
 */
const asHulaGame = (room: RoomState): HulaGameData => {
  if (room.game.type !== "HULA") throw new Error("훌라 방이 아닙니다.");
  return room.game;
};

/**
 * 카드 배열을 무작위로 섞는다 (Fisher-Yates).
 * @param cards - 섞을 카드 배열
 * @returns 새로 섞인 배열 (원본은 변경하지 않음)
 */
const shuffle = (cards: HulaCard[]): HulaCard[] => {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * 훌라 게임을 시작한다: 각자 7장을 나눠준다. 더미는 비어 있어서 첫 사람은
 * 덱에서 가져와야 한다. 시작 플레이어는 무작위로 정한다.
 * @param room - 대상 방
 */
export const startHulaGame = (room: RoomState): void => {
  const deck = shuffle(createHulaDeck());

  const hands: Record<string, HulaCard[]> = {};
  for (const player of room.players) {
    hands[player.userId] = deck.splice(0, HAND_DEAL_SIZE);
  }

  room.game = {
    type: "HULA",
    deck,
    // 더미는 비운 채로 시작한다 — 첫 사람은 덱에서 가져와야 한다.
    discard: [],
    hands,
    melds: [],
    currentPlayerIndex: Math.floor(Math.random() * room.players.length),
    hasDrawn: false,
    winnerUserId: null,
    scores: null,
    movesMade: 0,
  };
};

/**
 * 현재 차례인 플레이어의 userId를 반환한다.
 * @param room - 대상 방
 * @param game - 훌라 게임 상태
 * @returns 현재 차례 플레이어의 userId, 없으면 null
 */
const currentPlayerId = (room: RoomState, game: HulaGameData): string | null =>
  room.players[game.currentPlayerIndex]?.userId ?? null;

/**
 * 게임이 진행 중이고, 요청자가 현재 차례인지 확인한다. 아니면 예외를 던진다.
 * @param room - 대상 방
 * @param game - 훌라 게임 상태
 * @param requesterId - 요청한 게스트 id
 */
const assertTurn = (room: RoomState, game: HulaGameData, requesterId: string): void => {
  if (room.status !== "PLAYING") throw new Error("게임이 진행 중이 아닙니다.");
  // 승자가 정해진 뒤 결과 화면으로 넘어가기까지 잠깐 PLAYING이 유지되므로,
  // 그사이 들어오는 조작은 여기서 막는다.
  if (game.winnerUserId) throw new Error("게임이 이미 끝났습니다.");
  if (currentPlayerId(room, game) !== requesterId) {
    throw new Error("당신의 차례가 아닙니다.");
  }
};

/**
 * 손패에서 카드 id 목록에 해당하는 카드들을 찾는다. 하나라도 없으면 예외.
 * @param hand - 대상 손패
 * @param cardIds - 찾을 카드 id 목록
 * @returns 찾은 카드들
 */
const takeCards = (hand: HulaCard[], cardIds: string[]): HulaCard[] => {
  if (new Set(cardIds).size !== cardIds.length) {
    throw new Error("같은 카드를 두 번 쓸 수 없습니다.");
  }
  return cardIds.map((id) => {
    const found = hand.find((card) => card.id === id);
    if (!found) throw new Error("가지고 있지 않은 카드입니다.");
    return found;
  });
};

/**
 * 손패에서 카드들을 빼낸다.
 * @param hand - 대상 손패
 * @param cards - 빼낼 카드들
 */
const removeFromHand = (hand: HulaCard[], cards: HulaCard[]): void => {
  for (const card of cards) hand.splice(hand.indexOf(card), 1);
};

/**
 * 덱이 비면 더미(맨 위 한 장 제외)를 섞어 덱을 다시 채운다.
 * @param game - 훌라 게임 상태
 */
const replenishDeck = (game: HulaGameData): void => {
  if (game.deck.length > 0 || game.discard.length <= 1) return;
  const top = game.discard.pop() as HulaCard;
  game.deck = shuffle(game.discard);
  game.discard = [top];
};

/**
 * 손패를 다 턴 사람이 나왔으면 게임을 끝내고 벌점을 확정한다.
 * @param room - 대상 방
 * @param game - 훌라 게임 상태
 * @param requesterId - 방금 수를 둔 플레이어
 * @returns 게임이 끝났으면 true
 */
const settleIfFinished = (
  room: RoomState,
  game: HulaGameData,
  requesterId: string,
): boolean => {
  if (game.hands[requesterId].length > 0) return false;

  game.winnerUserId = requesterId;
  game.scores = Object.fromEntries(
    room.players.map((player) => [
      player.userId,
      hulaHandPoints(game.hands[player.userId]),
    ]),
  );
  return true;
};

export interface HulaDrawResult {
  /** 가져온 카드 (애니메이션용). */
  drawn: HulaCard;
  source: HulaDrawSource;
}

/**
 * 덱이나 더미 맨 위에서 카드를 한 장 가져온다. 차례마다 한 번만 할 수 있다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @param source - 가져올 곳 (덱 또는 더미)
 * @returns 가져온 카드와 출처
 */
export const drawHulaCard = (
  room: RoomState,
  requesterId: string,
  source: HulaDrawSource,
): HulaDrawResult => {
  const game = asHulaGame(room);
  assertTurn(room, game, requesterId);
  if (game.hasDrawn) throw new Error("이번 차례에는 이미 카드를 가져왔습니다.");

  if (source === "discard") {
    const card = game.discard.pop();
    if (!card) throw new Error("더미가 비어 있습니다.");
    game.hands[requesterId].unshift(card);
    game.hasDrawn = true;
    game.movesMade += 1;
    return { drawn: card, source };
  }

  replenishDeck(game);
  const card = game.deck.pop();
  if (!card) throw new Error("더 가져올 카드가 없습니다.");
  game.hands[requesterId].unshift(card);
  game.hasDrawn = true;
  game.movesMade += 1;
  return { drawn: card, source };
};

export interface HulaMeldResult {
  meld: HulaMeld;
  gameOver: boolean;
}

/**
 * 손패에서 조합을 등록한다 — 같은 숫자 3장 이상, 같은 무늬 연속 3장 이상,
 * 그리고 7은 한 장만으로도 등록할 수 있다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @param cardIds - 등록할 카드 id 목록
 * @returns 등록된 조합과 게임 종료 여부
 */
export const registerHulaMeld = (
  room: RoomState,
  requesterId: string,
  cardIds: string[],
): HulaMeldResult => {
  const game = asHulaGame(room);
  assertTurn(room, game, requesterId);
  if (!game.hasDrawn) throw new Error("먼저 카드를 한 장 가져와야 합니다.");

  const hand = game.hands[requesterId];
  const cards = takeCards(hand, cardIds);
  const kind = classifyMeld(cards);
  if (!kind) {
    throw new Error(
      "같은 숫자 3장 이상, 같은 무늬 연속 3장 이상, 또는 7 한 장이어야 합니다.",
    );
  }

  removeFromHand(hand, cards);
  const meld: HulaMeld = {
    id: `meld-${(meldIdSeq += 1)}`,
    ownerId: requesterId,
    kind,
    cards: sortMeldCards(kind, cards),
  };
  game.melds.push(meld);
  game.movesMade += 1;

  return { meld, gameOver: settleIfFinished(room, game, requesterId) };
};

export interface HulaAppendResult {
  meldId: string;
  /** 같은 숫자 4장이 채워져 조합이 통째로 사라졌는지. */
  meldRemoved: boolean;
  gameOver: boolean;
}

/**
 * 이미 등록된 조합에 손패의 카드 한 장을 붙인다. 자기 조합을 하나라도 등록한
 * 사람만 붙일 수 있다. 같은 숫자가 4장이 되면 그 조합은 통째로 사라진다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @param meldId - 붙일 조합 id
 * @param cardId - 붙일 카드 id
 * @returns 붙인 결과
 */
export const appendToHulaMeld = (
  room: RoomState,
  requesterId: string,
  meldId: string,
  cardId: string,
): HulaAppendResult => {
  const game = asHulaGame(room);
  assertTurn(room, game, requesterId);
  if (!game.hasDrawn) throw new Error("먼저 카드를 한 장 가져와야 합니다.");
  if (!game.melds.some((m) => m.ownerId === requesterId)) {
    throw new Error("먼저 자기 조합을 등록해야 붙일 수 있습니다.");
  }

  const meld = game.melds.find((m) => m.id === meldId);
  if (!meld) throw new Error("없는 조합입니다.");

  const hand = game.hands[requesterId];
  const [card] = takeCards(hand, [cardId]);
  if (!canAppendToMeld(meld, card))
    throw new Error("이 조합에는 붙일 수 없는 카드입니다.");

  removeFromHand(hand, [card]);
  meld.cards = withAppendedCard(meld, card);
  game.movesMade += 1;

  // 같은 숫자 네 무늬가 다 모이면 그 조합은 바닥에서 사라진다. 등록한 사람의
  // 조합이 그것뿐이었다면 그 사람은 다시 미등록 상태가 된다.
  const meldRemoved = meld.kind === "SET" && meld.cards.length >= SET_COMPLETE_SIZE;
  if (meldRemoved) game.melds = game.melds.filter((m) => m.id !== meld.id);

  return {
    meldId,
    meldRemoved,
    gameOver: settleIfFinished(room, game, requesterId),
  };
};

export interface HulaDiscardResult {
  discarded: HulaCard;
  gameOver: boolean;
}

/**
 * 카드 한 장을 버리고 차례를 넘긴다. 이 카드로 손패가 비면 게임이 끝난다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @param cardId - 버릴 카드 id
 * @returns 버린 카드와 게임 종료 여부
 */
export const discardHulaCard = (
  room: RoomState,
  requesterId: string,
  cardId: string,
): HulaDiscardResult => {
  const game = asHulaGame(room);
  assertTurn(room, game, requesterId);
  if (!game.hasDrawn) throw new Error("먼저 카드를 한 장 가져와야 합니다.");

  const hand = game.hands[requesterId];
  const [card] = takeCards(hand, [cardId]);
  removeFromHand(hand, [card]);
  game.discard.push(card);
  game.movesMade += 1;

  if (settleIfFinished(room, game, requesterId)) {
    return { discarded: card, gameOver: true };
  }

  game.hasDrawn = false;
  game.currentPlayerIndex = (game.currentPlayerIndex + 1) % room.players.length;
  return { discarded: card, gameOver: false };
};

/**
 * 게임 종료 연출이 끝난 뒤, 방 상태를 FINISHED로 바꿔 결과 화면으로 넘긴다.
 * @param room - 대상 방
 */
export const finalizeHulaGameOver = (room: RoomState): void => {
  asHulaGame(room);
  room.status = "FINISHED";
};

/**
 * 결과 저장용으로 플레이어의 등수를 계산한다 — 벌점이 낮을수록 앞 등수다.
 * @param room - 대상 방
 * @param userId - 대상 플레이어
 * @returns 등수(1부터)
 */
export const hulaRankOf = (room: RoomState, userId: string): number => {
  const { scores } = asHulaGame(room);
  if (!scores) return room.players.length;

  const myScore = scores[userId] ?? 0;
  const better = room.players.filter((p) => (scores[p.userId] ?? 0) < myScore).length;
  return better + 1;
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
export const checkHulaLastPlayerStanding = (
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
  room.game = createIdleHulaGame();

  return { winnerUserId: winner.userId, removedPlayerIds };
};

export interface PublicHulaPlayer {
  userId: string;
  handCount: number;
  /** 보는 사람 본인의 손패만 실제 카드가 담긴다. */
  hand: HulaCard[] | null;
  /** 자기 조합을 하나라도 등록했는지 (붙이기 가능 여부). */
  registered: boolean;
  /** 종료 후 확정된 벌점. 진행 중에는 null. */
  score: number | null;
}

export interface PublicHulaGameState {
  type: "HULA";
  deckCount: number;
  discard: HulaCard[];
  melds: HulaMeld[];
  currentPlayerId: string | null;
  hasDrawn: boolean;
  winnerUserId: string | null;
  movesMade: number;
  players: PublicHulaPlayer[];
}

/**
 * 클라이언트로 보낼 수 있는 형태로 훌라 게임 상태를 가공한다. 보는 사람
 * 본인의 손패만 실제 값을 보내고, 나머지는 개수만 보낸다.
 * @param room - 대상 방
 * @param forUserId - 이 상태를 받을 플레이어
 * @returns 클라이언트용 훌라 게임 상태
 */
export const publicHulaGameState = (
  room: RoomState,
  forUserId: string,
): PublicHulaGameState => {
  const game = asHulaGame(room);

  return {
    type: "HULA",
    deckCount: game.deck.length,
    discard: game.discard,
    melds: game.melds,
    currentPlayerId: currentPlayerId(room, game),
    hasDrawn: game.hasDrawn,
    winnerUserId: game.winnerUserId,
    movesMade: game.movesMade,
    players: room.players.map((player) => ({
      userId: player.userId,
      handCount: game.hands[player.userId]?.length ?? 0,
      hand:
        player.userId === forUserId
          ? sortHulaHand(game.hands[player.userId] ?? [])
          : null,
      registered: game.melds.some((meld) => meld.ownerId === player.userId),
      score: game.scores?.[player.userId] ?? null,
    })),
  };
};
