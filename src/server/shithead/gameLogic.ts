import type { RoomState } from "@/server/roomManager";
import {
  type Card,
  canPlayCards,
  canPlaySingleCard,
  createDeck,
  findStarterIndex,
  shouldBurnPile,
  shuffleCards,
} from "@/server/shithead/deck";

const HAND_REFILL_TARGET = 3;
const INITIAL_HAND_DEAL_SIZE = 6;
const FACE_UP_PICK_SIZE = 3;
const FACE_DOWN_SIZE = 3;

export interface ShitheadGameData {
  type: "SHITHEAD";
  deck: Card[];
  pile: Card[];
  currentPlayerIndex: number;
  winnerUserId: string | null;
  finishedOrder: string[];
  hands: Record<string, Card[]>;
  faceUp: Record<string, Card[]>;
  faceDown: Record<string, Card[]>;
  /** 각 플레이어가 손패 6장 중 바닥패로 놓을 3장을 다 골랐는지 */
  selectionDone: Record<string, boolean>;
}

/**
 * 아직 시작하지 않은 싯헤드 방의 기본 게임 상태를 만든다.
 * @returns 초기 싯헤드 게임 상태
 */
export const createIdleShitheadGame = (): ShitheadGameData => ({
  type: "SHITHEAD",
  deck: [],
  pile: [],
  currentPlayerIndex: 0,
  winnerUserId: null,
  finishedOrder: [],
  hands: {},
  faceUp: {},
  faceDown: {},
  selectionDone: {},
});

/**
 * room.game이 싯헤드 상태인지 확인하고 좁혀서 반환한다.
 * @param room - 대상 방
 * @returns 싯헤드 게임 상태
 */
const asShitheadGame = (room: RoomState): ShitheadGameData => {
  if (room.game.type !== "SHITHEAD") throw new Error("싯헤드 방이 아닙니다.");
  return room.game;
};

/**
 * 싯헤드 게임을 시작한다: 뒷카드 3장 + 손패 6장을 나눠주고(얼굴카드는
 * 아직 비어있음 — 각자 손패에서 3장을 골라야 함), 배분된 카드 중 가장
 * 낮은 카드(보통 클로버 3, 없으면 그다음으로 낮은 카드)를 든 사람부터
 * 시작하도록 정해둔다. 클로버 3이 아무에게도 배분되지 않고 덱(더미)에
 * 남아있을 수도 있어서 정확히 클로버 3만 찾으면 안 되고 일반화된 최저
 * 카드 비교가 필요하다. 실제 턴 진행은 전원이 얼굴카드를 고른 뒤 시작된다.
 * @param room - 대상 방
 */
export const startShitheadGame = (room: RoomState): void => {
  const deck = shuffleCards(createDeck());
  const hands: Record<string, Card[]> = {};
  const faceUp: Record<string, Card[]> = {};
  const faceDown: Record<string, Card[]> = {};
  const selectionDone: Record<string, boolean> = {};

  for (const p of room.players) {
    faceDown[p.userId] = deck.splice(0, FACE_DOWN_SIZE);
    faceUp[p.userId] = [];
    hands[p.userId] = deck.splice(0, INITIAL_HAND_DEAL_SIZE);
    selectionDone[p.userId] = false;
  }

  const starterIndex = findStarterIndex(
    room.players.map((p) => [...hands[p.userId], ...faceDown[p.userId]]),
  );

  room.game = {
    type: "SHITHEAD",
    deck,
    pile: [],
    currentPlayerIndex: starterIndex >= 0 ? starterIndex : 0,
    winnerUserId: null,
    finishedOrder: [],
    hands,
    faceUp,
    faceDown,
    selectionDone,
  };
};

/**
 * 손패 6장 중 바닥패(얼굴카드)로 놓을 3장을 고른다. 차례와 무관하게 아무
 * 때나(딜 직후) 할 수 있고, 전원이 고르기 전까지는 실제 플레이가 시작되지
 * 않는다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @param cardIds - 얼굴카드로 놓을 카드 id 3개
 */
export const selectFaceUpCards = (
  room: RoomState,
  requesterId: string,
  cardIds: string[],
): void => {
  const game = asShitheadGame(room);
  if (game.selectionDone[requesterId]) throw new Error("이미 바닥패를 골랐습니다.");
  if (cardIds.length !== FACE_UP_PICK_SIZE) {
    throw new Error(`바닥패로 놓을 카드 ${FACE_UP_PICK_SIZE}장을 선택해주세요.`);
  }

  const hand = game.hands[requesterId];
  const selected = cardIds.map((id) => {
    const card = hand.find((c) => c.id === id);
    if (!card) throw new Error("가지고 있지 않은 카드입니다.");
    return card;
  });

  game.hands[requesterId] = hand.filter((c) => !selected.includes(c));
  game.faceUp[requesterId] = selected;
  game.selectionDone[requesterId] = true;
};

/**
 * 현재 차례인 플레이어의 userId를 반환한다.
 * @param room - 대상 방
 * @param game - 싯헤드 게임 상태
 * @returns 현재 차례 플레이어의 userId, 없으면 null
 */
const currentPlayerId = (room: RoomState, game: ShitheadGameData): string | null =>
  room.players[game.currentPlayerIndex]?.userId ?? null;

/**
 * 게임이 진행 중이고, 요청자가 현재 차례인지 확인한다. 아니면 예외를 던진다.
 * @param room - 대상 방
 * @param game - 싯헤드 게임 상태
 * @param requesterId - 요청한 게스트 id
 */
const assertTurn = (
  room: RoomState,
  game: ShitheadGameData,
  requesterId: string,
): void => {
  if (room.status !== "PLAYING") throw new Error("게임이 진행 중이 아닙니다.");
  if (room.players.some((p) => !game.selectionDone[p.userId])) {
    throw new Error("모두 바닥패를 고를 때까지 기다려주세요.");
  }
  if (currentPlayerId(room, game) !== requesterId) {
    throw new Error("당신의 차례가 아닙니다.");
  }
};

/**
 * 다 낸 사람을 건너뛰고 다음 차례 플레이어의 인덱스를 찾는다.
 * @param room - 대상 방
 * @param game - 싯헤드 게임 상태
 * @param fromIndex - 기준 인덱스 (다음 사람부터 탐색)
 * @returns 다음 차례 플레이어의 인덱스
 */
const findNextActiveIndex = (
  room: RoomState,
  game: ShitheadGameData,
  fromIndex: number,
): number => {
  for (let step = 1; step <= room.players.length; step++) {
    const idx = (fromIndex + step) % room.players.length;
    if (!game.finishedOrder.includes(room.players[idx].userId)) return idx;
  }
  return fromIndex;
};

/**
 * 남은 덱에서 손패가 다시 3장이 되도록 채운다.
 * @param game - 싯헤드 게임 상태
 * @param userId - 카드를 채울 플레이어
 */
const refillHand = (game: ShitheadGameData, userId: string): void => {
  const hand = game.hands[userId];
  while (hand.length < HAND_REFILL_TARGET && game.deck.length > 0) {
    hand.push(game.deck.pop() as Card);
  }
};

export interface PlayResult {
  finished: boolean;
  gameOver: boolean;
  winnerUserId: string | null;
}

/**
 * 이 플레이어의 손패/얼굴카드/뒷카드가 전부 비었는지 확인한다.
 * @param game - 싯헤드 게임 상태
 * @param userId - 확인할 플레이어
 * @returns 세 무더기가 모두 비었으면 true
 */
const hasNoCardsLeft = (game: ShitheadGameData, userId: string): boolean =>
  game.hands[userId].length === 0 &&
  game.faceUp[userId].length === 0 &&
  game.faceDown[userId].length === 0;

/**
 * 카드를 낸 뒤 공통으로 처리하는 부분: 더미 태우기, 완주 판정, 게임 종료
 * 판정, 다음 차례 결정까지 한 번에 처리한다.
 * @param room - 대상 방
 * @param game - 싯헤드 게임 상태
 * @param requesterId - 방금 카드를 낸 플레이어
 * @returns 완주/게임종료 여부
 */
const resolveAfterPlay = (
  room: RoomState,
  game: ShitheadGameData,
  requesterId: string,
): PlayResult => {
  const burned = shouldBurnPile(game.pile);
  if (burned) game.pile = [];

  const finished = hasNoCardsLeft(game, requesterId);
  if (finished && !game.finishedOrder.includes(requesterId)) {
    game.finishedOrder.push(requesterId);
  }

  const stillPlaying = room.players.filter((p) => !game.finishedOrder.includes(p.userId));
  if (stillPlaying.length <= 1) {
    if (stillPlaying.length === 1) game.finishedOrder.push(stillPlaying[0].userId);
    room.status = "FINISHED";
    return { finished, gameOver: true, winnerUserId: game.finishedOrder[0] ?? null };
  }

  // 더미를 태웠거나(10, 4장 매치) 완주해서 이 자리가 빠지는 경우가 아니면
  // 태웠을 때만 같은 사람이 한 번 더 낸다.
  if (!burned || finished) {
    game.currentPlayerIndex = findNextActiveIndex(room, game, game.currentPlayerIndex);
  }

  return { finished, gameOver: false, winnerUserId: null };
};

/**
 * 손패 또는 얼굴카드에서 같은 랭크 카드(1장 이상)를 낸다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @param cardIds - 내려는 카드 id들 (전부 같은 랭크)
 * @returns 완주/게임종료 여부
 */
export const playFromHandOrFaceUp = (
  room: RoomState,
  requesterId: string,
  cardIds: string[],
): PlayResult => {
  const game = asShitheadGame(room);
  assertTurn(room, game, requesterId);
  if (cardIds.length === 0) throw new Error("낼 카드를 선택해주세요.");

  const hand = game.hands[requesterId];
  const faceUp = game.faceUp[requesterId];
  if (hand.length === 0 && faceUp.length === 0) {
    throw new Error("뒷카드는 직접 뒤집어야 합니다.");
  }
  const playedFromHand = hand.length > 0;
  const zone = playedFromHand ? hand : faceUp;

  const selected = cardIds.map((id) => {
    const card = zone.find((c) => c.id === id);
    if (!card) throw new Error("가지고 있지 않은 카드입니다.");
    return card;
  });

  if (!canPlayCards(game.pile, selected)) throw new Error("낼 수 없는 카드입니다.");

  for (const card of selected) {
    const idx = zone.indexOf(card);
    zone.splice(idx, 1);
    game.pile.push(card);
  }

  // 손패에서 냈고 덱에 남은 카드가 있으면, 낸 만큼 곧바로 다시 3장을 채운다
  // (얼굴카드에서 낸 경우는 손패 단계가 끝난 것이므로 채우지 않는다).
  if (playedFromHand && game.deck.length > 0) {
    refillHand(game, requesterId);
  }

  return resolveAfterPlay(room, game, requesterId);
};

/**
 * 손패와 얼굴카드가 모두 빈 상태에서 뒷카드를 한 장 뒤집어 낸다. 낼 수 없는
 * 카드면 더미 전체와 함께 손패로 가져온다. 뒷카드는 본인도 무슨 카드인지
 * 모르는 상태라 id가 아니라 몇 번째 카드인지(index)로 지정한다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @param index - 뒤집을 뒷카드의 위치 (0부터)
 * @returns 완주/게임종료 여부와 카드가 실제로 나갔는지
 */
export const playFromFaceDown = (
  room: RoomState,
  requesterId: string,
  index: number,
): PlayResult & { accepted: boolean } => {
  const game = asShitheadGame(room);
  assertTurn(room, game, requesterId);
  if (game.hands[requesterId].length > 0 || game.faceUp[requesterId].length > 0) {
    throw new Error("손패와 얼굴카드부터 내야 합니다.");
  }

  const faceDown = game.faceDown[requesterId];
  if (index < 0 || index >= faceDown.length)
    throw new Error("가지고 있지 않은 카드입니다.");
  const [card] = faceDown.splice(index, 1);

  if (canPlaySingleCard(game.pile, card)) {
    game.pile.push(card);
    return { ...resolveAfterPlay(room, game, requesterId), accepted: true };
  }

  // 낼 수 없는 카드 — 더미 전체와 함께 손패로 가져오고 차례가 넘어간다.
  game.hands[requesterId].push(card, ...game.pile);
  game.pile = [];
  game.currentPlayerIndex = findNextActiveIndex(room, game, game.currentPlayerIndex);
  return { finished: false, gameOver: false, winnerUserId: null, accepted: false };
};

/**
 * 더미 전체를 손패로 가져오고 차례를 넘긴다. 낼 수 있는 카드가 있어도 전략적으로
 * 주울 수 있다. 단 손패·얼굴카드가 모두 없는 블라인드 단계에서는 뒷카드를 직접
 * 뒤집어야 하므로 주울 수 없다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 */
export const pickUpPile = (room: RoomState, requesterId: string): void => {
  const game = asShitheadGame(room);
  assertTurn(room, game, requesterId);

  const hand = game.hands[requesterId];
  const faceUp = game.faceUp[requesterId];
  if (hand.length === 0 && faceUp.length === 0) {
    throw new Error("뒷카드는 직접 뒤집어야 합니다.");
  }
  if (game.pile.length === 0) throw new Error("가져올 더미가 없습니다.");

  hand.push(...game.pile);
  game.pile = [];
  game.currentPlayerIndex = findNextActiveIndex(room, game, game.currentPlayerIndex);
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
export const checkShitheadLastPlayerStanding = (
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
  room.game = createIdleShitheadGame();
  room.game.winnerUserId = winner.userId;
  room.hostId = winner.userId;

  return { winnerUserId: winner.userId, removedPlayerIds };
};

export interface PublicShitheadPlayer {
  userId: string;
  handCount: number;
  hand: Card[] | null;
  faceUp: Card[];
  faceDownCount: number;
  finishRank: number | null;
  selectionDone: boolean;
}

export interface PublicShitheadGameState {
  type: "SHITHEAD";
  pile: Card[];
  deckCount: number;
  currentPlayerId: string | null;
  winnerUserId: string | null;
  players: PublicShitheadPlayer[];
}

/**
 * 클라이언트로 보낼 수 있는 형태로 싯헤드 게임 상태를 가공한다. 보는 사람
 * 본인의 손패만 실제 값을 보내고, 나머지는 개수만 보낸다 (뒷카드는 본인도
 * 못 봄).
 * @param room - 대상 방
 * @param forUserId - 이 상태를 받을 플레이어
 * @returns 클라이언트용 싯헤드 게임 상태
 */
export const publicShitheadGameState = (
  room: RoomState,
  forUserId: string,
): PublicShitheadGameState => {
  const game = asShitheadGame(room);
  const allSelected = room.players.every((p) => game.selectionDone[p.userId]);

  return {
    type: "SHITHEAD",
    pile: game.pile,
    deckCount: game.deck.length,
    currentPlayerId: allSelected ? currentPlayerId(room, game) : null,
    winnerUserId: game.winnerUserId,
    players: room.players.map((p) => ({
      userId: p.userId,
      handCount: game.hands[p.userId]?.length ?? 0,
      hand: p.userId === forUserId ? (game.hands[p.userId] ?? []) : null,
      faceUp: game.faceUp[p.userId] ?? [],
      faceDownCount: game.faceDown[p.userId]?.length ?? 0,
      finishRank:
        game.finishedOrder.indexOf(p.userId) === -1
          ? null
          : game.finishedOrder.indexOf(p.userId) + 1,
      selectionDone: game.selectionDone[p.userId] ?? false,
    })),
  };
};
