import type { RoomState } from "@/server/roomManager";
import {
  type Card,
  type Rank,
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
  /** 가장 최근 한 번에 낸 장수. 더미 hover에서 몇 장을 펼칠지 정하는 데 쓴다. */
  lastPlayedCount: number;
  currentPlayerIndex: number;
  winnerUserId: string | null;
  finishedOrder: string[];
  hands: Record<string, Card[]>;
  faceUp: Record<string, Card[]>;
  /**
   * 바닥패 3자리. 배열 길이는 항상 FACE_DOWN_SIZE로 고정되고, 낸 자리는
   * 배열에서 지우지 않고 null로 남긴다 — 그래야 화면에서도 그 자리가
   * 빈 자리로 계속 남고 다른 카드들이 자리를 당겨오지 않는다.
   */
  faceDown: Record<string, (Card | null)[]>;
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
  lastPlayedCount: 0,
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
 * 아직 비어있음 — 각자 손패에서 3장을 골라야 함), 손패 6장 중 가장 낮은
 * 카드(보통 클로버 3, 없으면 그다음으로 낮은 카드)를 든 사람부터 시작하도록
 * 정해둔다. 뒷카드는 본인도 못 보는 카드라 시작 순서 판정에 넣지 않는다.
 * 클로버 3이 아무에게도 배분되지 않고 덱(더미)에 남아있을 수도 있어서
 * 정확히 클로버 3만 찾으면 안 되고 일반화된 최저 카드 비교가 필요하다.
 * 실제 턴 진행은 전원이 얼굴카드를 고른 뒤 시작된다.
 * @param room - 대상 방
 */
export const startShitheadGame = (room: RoomState): void => {
  // 6인은 1인당 9장이라 54장(조커 2장 포함)이어야 나눠줄 수 있다.
  const deck = shuffleCards(createDeck(room.useJokers));
  const hands: Record<string, Card[]> = {};
  const faceUp: Record<string, Card[]> = {};
  const faceDown: Record<string, (Card | null)[]> = {};
  const selectionDone: Record<string, boolean> = {};

  for (const p of room.players) {
    faceDown[p.userId] = deck.splice(0, FACE_DOWN_SIZE);
    faceUp[p.userId] = [];
    hands[p.userId] = deck.splice(0, INITIAL_HAND_DEAL_SIZE);
    selectionDone[p.userId] = false;
  }

  const starterIndex = findStarterIndex(room.players.map((p) => hands[p.userId]));

  room.game = {
    type: "SHITHEAD",
    deck,
    pile: [],
    lastPlayedCount: 0,
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
    // 새로 뽑은 카드는 손패 맨 앞(화면 왼쪽)에 넣는다 — 화면에서는 왼쪽으로
    // 들어오면서 기존 카드를 오른쪽으로 밀어내는 연출이 된다.
    hand.unshift(game.deck.pop() as Card);
  }
};

export interface PlayResult {
  finished: boolean;
  gameOver: boolean;
  winnerUserId: string | null;
  /** 이번에 더미로 나간 카드들 (애니메이션용). 주운 경우처럼 안 나갔으면 빈 배열. */
  played: Card[];
  /** 카드를 낸 뒤 덱에서 손패로 보충한 장수 (애니메이션용). */
  refilled: number;
  /**
   * 이번에 더미를 태워야 하는지. 여기서는 아직 더미를 비우지 않는다 — 카드가
   * 쌓인 모습을 먼저 보여준 뒤(애니메이션), server.ts가 burnPile을 따로
   * 호출해 지운다.
   */
  burned: boolean;
}

/**
 * 이 플레이어의 손패/얼굴카드/뒷카드가 전부 비었는지 확인한다. 곧 덱에서
 * 채워질 장수(pendingRefill)가 있으면 아직 실제로 손패에 들어오지 않았어도
 * 빈 것으로 치지 않는다 — 재정렬 연출 때문에 반영이 늦춰졌을 뿐이다.
 * @param game - 싯헤드 게임 상태
 * @param userId - 확인할 플레이어
 * @param pendingRefill - 아직 반영되지 않은, 곧 채워질 손패 장수
 * @returns 세 무더기가 모두 비었으면 true
 */
const hasNoCardsLeft = (
  game: ShitheadGameData,
  userId: string,
  pendingRefill: number,
): boolean =>
  game.hands[userId].length + pendingRefill === 0 &&
  game.faceUp[userId].length === 0 &&
  game.faceDown[userId].every((c) => c === null);

/**
 * 카드를 낸 뒤 공통으로 처리하는 부분: 태울지 판정, 완주 판정, 게임 종료
 * 판정, 다음 차례 결정까지 한 번에 처리한다.
 * @param room - 대상 방
 * @param game - 싯헤드 게임 상태
 * @param requesterId - 방금 카드를 낸 플레이어
 * @param played - 이번에 더미로 나간 카드들
 * @param refilled - 덱에서 손패로 보충 예정인 장수(애니메이션/완주 판정용)
 * @returns 완주/게임종료/태우기 여부
 */
const resolveAfterPlay = (
  room: RoomState,
  game: ShitheadGameData,
  requesterId: string,
  played: Card[],
  refilled: number,
): PlayResult => {
  const burned = shouldBurnPile(game.pile);

  const finished = hasNoCardsLeft(game, requesterId, refilled);
  if (finished && !game.finishedOrder.includes(requesterId)) {
    game.finishedOrder.push(requesterId);
  }

  // 방 상태는 여기서 바로 FINISHED로 바꾸지 않는다 — 손패/더미 갱신은 다른
  // 카드 낼 때와 똑같이 즉시 브로드캐스트돼야 카드가 손패에 남아있다가 갑자기
  // 사라지는 것처럼 안 보인다. 결과 화면 전환만 finalizeGameOver로 미룬다.
  const stillPlaying = room.players.filter((p) => !game.finishedOrder.includes(p.userId));
  if (stillPlaying.length <= 1) {
    if (stillPlaying.length === 1) game.finishedOrder.push(stillPlaying[0].userId);
    return {
      finished,
      gameOver: true,
      winnerUserId: game.finishedOrder[0] ?? null,
      played,
      refilled,
      burned,
    };
  }

  // 더미를 태웠거나(10, 4장 매치) 완주해서 이 자리가 빠지는 경우가 아니면
  // 태웠을 때만 같은 사람이 한 번 더 낸다.
  if (!burned || finished) {
    game.currentPlayerIndex = findNextActiveIndex(room, game, game.currentPlayerIndex);
  }

  return { finished, gameOver: false, winnerUserId: null, played, refilled, burned };
};

/**
 * 더미가 다 쌓인 모습을 보여준 뒤, 실제로 더미를 비운다(태우기). 태울지
 * 여부 자체는 resolveAfterPlay가 이미 판정했고, 여기서는 반영만 한다.
 * @param room - 대상 방
 * @returns 태워서 사라진 카드들(애니메이션용)
 */
export const burnPile = (room: RoomState): Card[] => {
  const game = asShitheadGame(room);
  const burned = [...game.pile];
  game.pile = [];
  game.lastPlayedCount = 0;
  return burned;
};

/**
 * 마지막 패가 날아가는 연출이 끝난 뒤, 방 상태를 FINISHED로 바꿔 결과
 * 화면으로 넘긴다. 더미를 태우면서 동시에 게임이 끝난 경우(마지막 카드가
 * 태우기까지 유발)에는 별도 연출 없이 여기서 같이 비운다.
 * @param room - 대상 방
 */
export const finalizeGameOver = (room: RoomState): void => {
  const game = asShitheadGame(room);
  game.pile = [];
  room.status = "FINISHED";
};

/**
 * 손패 재정렬 연출이 끝난 뒤, 실제로 덱에서 손패를 채운다.
 * @param room - 대상 방
 * @param userId - 카드를 채울 플레이어
 * @returns 실제로 채운 장수
 */
export const applyPendingRefill = (room: RoomState, userId: string): number => {
  const game = asShitheadGame(room);
  const before = game.hands[userId].length;
  refillHand(game, userId);
  return game.hands[userId].length - before;
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

  // 조커는 같이 낸 카드의 숫자로 취급한다 — 더미 기준/4장 태우기 모두 그 숫자로 센다.
  const playedRank = selected.find((c) => c.rank !== "JOKER")?.rank as Rank;
  for (const card of selected) {
    const idx = zone.indexOf(card);
    zone.splice(idx, 1);
    game.pile.push(card.rank === "JOKER" ? { ...card, playedAs: playedRank } : card);
  }
  game.lastPlayedCount = selected.length;

  // 손패에서 냈고 덱에 남은 카드가 있으면 다시 3장이 되도록 채워야 하지만,
  // 실제로 손패에 넣는 건 재정렬 연출이 끝난 뒤 server.ts가 applyPendingRefill로
  // 따로 한다 — 여기서는 몇 장이 채워질지만 미리 계산한다(완주 판정에 필요).
  const pendingRefill = playedFromHand
    ? Math.max(0, Math.min(HAND_REFILL_TARGET - hand.length, game.deck.length))
    : 0;

  return resolveAfterPlay(room, game, requesterId, selected, pendingRefill);
};

export interface FaceDownFlip {
  card: Card;
  accepted: boolean;
}

/**
 * 손패와 얼굴카드가 모두 빈 상태에서 뒷카드 한 장을 뒤집어 값을 확인한다.
 * 뒤집기 연출(뒤집힘 → 1초 유지) 동안 보여줄 정보만 반환하고, 실제 게임
 * 상태 반영(더미에 내거나 손패로 옮기는 것)은 하지 않는다 — 그건 연출이
 * 끝난 뒤 commitFaceDownPlay/commitFaceDownToHand가 한다. 뒷카드는 본인도
 * 무슨 카드인지 모르는 상태라 id가 아니라 몇 번째 카드인지(index)로 지정한다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @param index - 뒤집을 뒷카드의 위치 (0부터)
 * @returns 뒤집힌 카드와 지금 낼 수 있는 카드인지 여부
 */
export const revealFaceDown = (
  room: RoomState,
  requesterId: string,
  index: number,
): FaceDownFlip => {
  const game = asShitheadGame(room);
  assertTurn(room, game, requesterId);
  if (game.hands[requesterId].length > 0 || game.faceUp[requesterId].length > 0) {
    throw new Error("손패와 얼굴카드부터 내야 합니다.");
  }

  const faceDown = game.faceDown[requesterId];
  const card = index >= 0 && index < faceDown.length ? faceDown[index] : null;
  if (!card) throw new Error("가지고 있지 않은 카드입니다.");

  return { card, accepted: canPlaySingleCard(game.pile, card) };
};

/**
 * 뒤집은 뒷카드가 낼 수 있는 카드였을 때, 그 자리를 비우고 더미에 반영한다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @param index - 뒤집었던 뒷카드의 위치
 * @returns 완주/게임종료 여부
 */
export const commitFaceDownPlay = (
  room: RoomState,
  requesterId: string,
  index: number,
): PlayResult => {
  const game = asShitheadGame(room);
  const card = game.faceDown[requesterId][index] as Card;
  game.faceDown[requesterId][index] = null;
  game.pile.push(card);
  game.lastPlayedCount = 1;
  return resolveAfterPlay(room, game, requesterId, [card], 0);
};

/**
 * 뒤집은 뒷카드가 낼 수 없는 카드였을 때, 먼저 그 자리를 비우고 카드 한 장만
 * 손패로 옮긴다. 더미 전체를 마저 가져오는 건 별도의 연출 뒤 commitFaceDownPickup이
 * 한다 — 뒷카드가 손패로 옮겨지는 모습과 더미가 쓸려오는 모습을 순서대로 보여주기 위함.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @param index - 뒤집었던 뒷카드의 위치
 */
export const commitFaceDownToHand = (
  room: RoomState,
  requesterId: string,
  index: number,
): void => {
  const game = asShitheadGame(room);
  const card = game.faceDown[requesterId][index] as Card;
  game.faceDown[requesterId][index] = null;
  game.hands[requesterId].push(card);
};

/**
 * commitFaceDownToHand 뒤, 더미 전체를 마저 손패로 가져오고 차례를 넘긴다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @returns 손패로 가져온 더미 장수(애니메이션용)
 */
export const commitFaceDownPickup = (room: RoomState, requesterId: string): number => {
  const game = asShitheadGame(room);
  const pickedUp = game.pile.length;
  game.hands[requesterId].push(...game.pile);
  game.pile = [];
  game.lastPlayedCount = 0;
  game.currentPlayerIndex = findNextActiveIndex(room, game, game.currentPlayerIndex);
  return pickedUp;
};

/**
 * 더미 전체를 손패로 가져오고 차례를 넘긴다. 낼 수 있는 카드가 있어도 전략적으로
 * 주울 수 있다. 단 손패·얼굴카드가 모두 없는 블라인드 단계에서는 뒷카드를 직접
 * 뒤집어야 하므로 주울 수 없다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @returns 손패로 가져온 카드 수(애니메이션용)
 */
export const pickUpPile = (room: RoomState, requesterId: string): number => {
  const game = asShitheadGame(room);
  assertTurn(room, game, requesterId);

  const hand = game.hands[requesterId];
  const faceUp = game.faceUp[requesterId];
  if (hand.length === 0 && faceUp.length === 0) {
    throw new Error("뒷카드는 직접 뒤집어야 합니다.");
  }
  if (game.pile.length === 0) throw new Error("가져올 더미가 없습니다.");

  const takenCount = game.pile.length;
  hand.push(...game.pile);
  game.pile = [];
  game.currentPlayerIndex = findNextActiveIndex(room, game, game.currentPlayerIndex);
  return takenCount;
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
  /** 바닥패 3자리 중 아직 카드가 남아있는 자리는 true. 길이는 항상 고정. */
  faceDown: boolean[];
  finishRank: number | null;
  selectionDone: boolean;
}

export interface PublicShitheadGameState {
  type: "SHITHEAD";
  pile: Card[];
  /** 가장 최근 한 번에 낸 장수 (더미 hover 펼침용). */
  lastPlayedCount: number;
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
    lastPlayedCount: game.lastPlayedCount,
    deckCount: game.deck.length,
    currentPlayerId: allSelected ? currentPlayerId(room, game) : null,
    winnerUserId: game.winnerUserId,
    players: room.players.map((p) => ({
      userId: p.userId,
      handCount: game.hands[p.userId]?.length ?? 0,
      hand: p.userId === forUserId ? (game.hands[p.userId] ?? []) : null,
      faceUp: game.faceUp[p.userId] ?? [],
      faceDown: (game.faceDown[p.userId] ?? []).map((c) => c !== null),
      finishRank:
        game.finishedOrder.indexOf(p.userId) === -1
          ? null
          : game.finishedOrder.indexOf(p.userId) + 1,
      selectionDone: game.selectionDone[p.userId] ?? false,
    })),
  };
};
