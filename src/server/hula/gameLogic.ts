import type { RoomState } from "@/server/roomManager";
import { HULA_DECK_DRAW_DELAY_MS, HULA_STOP_MAX_POINTS } from "@/constants/hula";
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

export interface HulaThankYou {
  playerId: string;
  cardId: string;
}

/** 땡큐를 취소하면 되돌릴 차례 시작 시점의 상태. */
interface HulaTurnSnapshot {
  hands: Record<string, HulaCard[]>;
  melds: HulaMeld[];
  deck: HulaCard[];
  discard: HulaCard[];
  currentPlayerIndex: number;
  movesMade: number;
}

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
  /** 이번 차례에 땡큐로 가져온 카드. 이걸 쓰기 전에는 버릴 수 없다. */
  thankYou: HulaThankYou | null;
  /** 이번 차례에 취소된 땡큐들(`플레이어:카드` 키). 같은 카드를 다시 집는 반복을 막는다. */
  blockedThankYous: string[];
  /** 차례가 시작된 시각(ms). 덱은 이 시각에서 조금 지나야 열린다. */
  turnStartedAt: number;
  /** 땡큐 취소로 되돌릴 차례 시작 시점의 상태. */
  turnSnapshot: HulaTurnSnapshot | null;
  winnerUserId: string | null;
  /** 스톱을 부른 사람. 스톱으로 끝난 판을 구분한다. */
  stoppedByUserId: string | null;
  /** 등록 없이 한 차례에 손패를 다 턴 사람(훌라). 축하 연출에 쓴다. */
  hulaUserId: string | null;
  /** 종료 시 확정되는 플레이어별 손패 점수. 진행 중에는 null. */
  scores: Record<string, number> | null;
  /** 종료 시 확정되는 플레이어별 등수. 진행 중에는 null. */
  ranks: Record<string, number> | null;
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
  thankYou: null,
  blockedThankYous: [],
  turnStartedAt: 0,
  turnSnapshot: null,
  winnerUserId: null,
  stoppedByUserId: null,
  hulaUserId: null,
  scores: null,
  ranks: null,
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
 * 지금 상태를 차례 시작 시점 스냅샷으로 떠 둔다. 땡큐 취소는 이 시점으로
 * 통째로 되돌린다.
 * @param game - 훌라 게임 상태
 * @returns 깊은 복사된 스냅샷
 */
const snapshotTurn = (game: HulaGameData): HulaTurnSnapshot =>
  structuredClone({
    hands: game.hands,
    melds: game.melds,
    deck: game.deck,
    discard: game.discard,
    currentPlayerIndex: game.currentPlayerIndex,
    movesMade: game.movesMade,
  });

/**
 * 차례를 시작한다 — 가져오기 여부를 초기화하고 되돌릴 지점을 새로 잡는다.
 * @param game - 훌라 게임 상태
 * @param index - 이번 차례 플레이어의 자리 번호
 */
const beginTurn = (game: HulaGameData, index: number): void => {
  game.currentPlayerIndex = index;
  game.hasDrawn = false;
  game.thankYou = null;
  game.blockedThankYous = [];
  game.turnStartedAt = Date.now();
  game.turnSnapshot = snapshotTurn(game);
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
    ...createIdleHulaGame(),
    deck,
    hands,
  };
  beginTurn(room.game, Math.floor(Math.random() * room.players.length));
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
 * 게임이 아직 진행 중인지 확인한다. 아니면 예외를 던진다.
 * @param room - 대상 방
 * @param game - 훌라 게임 상태
 */
const assertPlaying = (room: RoomState, game: HulaGameData): void => {
  if (room.status !== "PLAYING") throw new Error("게임이 진행 중이 아닙니다.");
  // 승자가 정해진 뒤 결과 화면으로 넘어가기까지 잠깐 PLAYING이 유지되므로,
  // 그사이 들어오는 조작은 여기서 막는다.
  if (game.winnerUserId) throw new Error("게임이 이미 끝났습니다.");
};

/**
 * 게임이 진행 중이고, 요청자가 현재 차례인지 확인한다. 아니면 예외를 던진다.
 * @param room - 대상 방
 * @param game - 훌라 게임 상태
 * @param requesterId - 요청한 게스트 id
 */
const assertTurn = (room: RoomState, game: HulaGameData, requesterId: string): void => {
  assertPlaying(room, game);
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
 * 취소된 땡큐를 기억할 때 쓰는 키.
 * @param playerId - 땡큐한 사람
 * @param cardId - 땡큐한 카드
 * @returns 조합 키
 */
const thankYouKey = (playerId: string, cardId: string): string => `${playerId}:${cardId}`;

/**
 * 땡큐로 가져온 카드가 손을 떠났으면 의무를 푼다.
 * @param game - 훌라 게임 상태
 * @param requesterId - 방금 수를 둔 플레이어
 */
const clearThankYouIfUsed = (game: HulaGameData, requesterId: string): void => {
  const pending = game.thankYou;
  if (!pending || pending.playerId !== requesterId) return;
  const stillHeld = game.hands[requesterId].some((card) => card.id === pending.cardId);
  if (!stillHeld) game.thankYou = null;
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

interface HulaStanding {
  userId: string;
  points: number;
  count: number;
  registered: boolean;
}

/**
 * 지금 손패 기준으로 플레이어별 점수·장수·등록 여부를 모은다.
 * @param room - 대상 방
 * @param game - 훌라 게임 상태
 * @returns 플레이어별 집계
 */
const buildStandings = (room: RoomState, game: HulaGameData): HulaStanding[] =>
  room.players.map((player) => ({
    userId: player.userId,
    points: hulaHandPoints(game.hands[player.userId] ?? []),
    count: game.hands[player.userId]?.length ?? 0,
    registered: game.melds.some((meld) => meld.ownerId === player.userId),
  }));

/**
 * 점수가 낮은 순, 같으면 장수가 적은 순으로 비교한다.
 * @param a - 앞 사람
 * @param b - 뒷 사람
 * @returns 정렬 비교값
 */
const byPointsThenCount = (a: HulaStanding, b: HulaStanding): number =>
  a.points !== b.points ? a.points - b.points : a.count - b.count;

/**
 * 등록한 사람들을 앞에, 등록 못 한 사람들을 뒤에 두고 각각 점수순으로 나눈다.
 * 등록을 못 했으면 점수가 아무리 낮아도 등록한 사람보다 뒤 등수다.
 * @param standings - 나눌 대상
 * @returns 등록 그룹, 미등록 그룹 (빈 그룹은 빠진다)
 */
const splitByRegistered = (standings: HulaStanding[]): HulaStanding[][] =>
  [
    standings.filter((s) => s.registered).sort(byPointsThenCount),
    standings.filter((s) => !s.registered).sort(byPointsThenCount),
  ].filter((group) => group.length > 0);

/**
 * 순서대로 늘어놓은 그룹들에 등수를 매긴다. 같은 그룹 안에서 점수와 장수가
 * 모두 같으면 공동 등수이고, 그만큼 다음 등수는 건너뛴다(1, 2, 2, 4).
 * @param groups - 앞 등수부터 순서대로 정렬된 그룹들
 * @returns 플레이어별 등수
 */
const assignRanks = (groups: HulaStanding[][]): Record<string, number> => {
  const ranks: Record<string, number> = {};
  let placed = 0;

  for (const group of groups) {
    let tieRank = placed + 1;
    group.forEach((standing, index) => {
      const previous = group[index - 1];
      const tied =
        previous !== undefined &&
        previous.points === standing.points &&
        previous.count === standing.count;
      if (!tied) tieRank = placed + 1;
      ranks[standing.userId] = tieRank;
      placed += 1;
    });
  }
  return ranks;
};

/**
 * 등수표에서 1등을 찾는다.
 * @param ranks - 플레이어별 등수
 * @returns 1등 플레이어의 userId
 */
const firstPlaceOf = (ranks: Record<string, number>): string =>
  Object.entries(ranks).find(([, rank]) => rank === 1)?.[0] ?? "";

/**
 * 종료 시점의 점수·등수를 게임 상태에 적어 넣는다.
 * @param game - 훌라 게임 상태
 * @param standings - 플레이어별 집계
 * @param groups - 앞 등수부터 순서대로 정렬된 그룹들
 */
const settleScores = (
  game: HulaGameData,
  standings: HulaStanding[],
  groups: HulaStanding[][],
): void => {
  game.scores = Object.fromEntries(standings.map((s) => [s.userId, s.points]));
  game.ranks = assignRanks(groups);
};

/**
 * 손패를 다 턴 사람이 나왔으면 게임을 끝내고 등수를 확정한다. 이번 차례가
 * 시작될 때까지 등록이 하나도 없었다면 훌라(한 방에 털기)로 기록한다.
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
  const registeredBefore =
    game.turnSnapshot?.melds.some((meld) => meld.ownerId === requesterId) ?? false;
  if (!registeredBefore) game.hulaUserId = requesterId;

  const standings = buildStandings(room, game);
  const winner = standings.find((s) => s.userId === requesterId) as HulaStanding;
  const others = standings.filter((s) => s.userId !== requesterId);
  settleScores(game, standings, [[winner], ...splitByRegistered(others)]);
  return true;
};

export interface HulaDrawResult {
  /** 가져온 카드 (애니메이션용). */
  drawn: HulaCard;
  source: HulaDrawSource;
  /** 더미에서 가져와 차례를 가져온 경우(= 땡큐). */
  thankYou: boolean;
}

/**
 * 더미 맨 위 카드를 가져온다. 아직 이번 차례 사람이 카드를 가져오기 전이라면
 * 차례가 아닌 사람도 가져올 수 있고(땡큐), 그 순간 차례가 그 사람에게 넘어간다.
 * 먼저 도착한 요청이 hasDrawn을 세우므로 뒤늦은 요청은 여기서 막힌다.
 * @param room - 대상 방
 * @param game - 훌라 게임 상태
 * @param requesterId - 요청한 게스트 id
 * @returns 가져온 카드
 */
const takeFromDiscard = (
  room: RoomState,
  game: HulaGameData,
  requesterId: string,
): HulaDrawResult => {
  if (game.hasDrawn) throw new Error("이미 다른 사람이 가져갔습니다.");

  const seat = room.players.findIndex((player) => player.userId === requesterId);
  if (seat < 0) throw new Error("이 방의 참가자가 아닙니다.");

  const card = game.discard[game.discard.length - 1];
  if (!card) throw new Error("더미가 비어 있습니다.");

  if (game.blockedThankYous.includes(thankYouKey(requesterId, card.id))) {
    throw new Error("방금 취소한 카드는 다시 가져올 수 없습니다.");
  }

  game.discard.pop();
  game.hands[requesterId].unshift(card);
  game.currentPlayerIndex = seat;
  game.hasDrawn = true;
  game.thankYou = { playerId: requesterId, cardId: card.id };
  game.movesMade += 1;
  return { drawn: card, source: "discard", thankYou: true };
};

/**
 * 덱이나 더미 맨 위에서 카드를 한 장 가져온다. 덱은 이번 차례 사람만, 차례가
 * 시작되고 잠깐(HULA_DECK_DRAW_DELAY_MS) 지난 뒤에 가져올 수 있다 — 그사이
 * 다른 사람이 더미를 땡큐할 시간을 준다.
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
  assertPlaying(room, game);

  if (source === "discard") return takeFromDiscard(room, game, requesterId);

  assertTurn(room, game, requesterId);
  if (game.hasDrawn) throw new Error("이번 차례에는 이미 카드를 가져왔습니다.");
  if (Date.now() < game.turnStartedAt + HULA_DECK_DRAW_DELAY_MS) {
    throw new Error("잠시 뒤에 덱에서 가져올 수 있습니다.");
  }

  replenishDeck(game);
  const card = game.deck.pop();
  if (!card) throw new Error("더 가져올 카드가 없습니다.");
  game.hands[requesterId].unshift(card);
  game.hasDrawn = true;
  game.movesMade += 1;
  return { drawn: card, source, thankYou: false };
};

/**
 * 땡큐를 취소한다. 차례 시작 시점으로 통째로 되돌리므로, 그 차례에 등록하거나
 * 붙인 카드도 손패로 돌아오고 차례도 원래 사람에게 돌아간다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 */
export const cancelHulaThankYou = (room: RoomState, requesterId: string): void => {
  const game = asHulaGame(room);
  assertPlaying(room, game);

  const pending = game.thankYou;
  if (!pending || pending.playerId !== requesterId) {
    throw new Error("취소할 땡큐가 없습니다.");
  }

  const snapshot = game.turnSnapshot;
  if (!snapshot) throw new Error("되돌릴 수 없습니다.");

  const restored = structuredClone(snapshot);
  game.hands = restored.hands;
  game.melds = restored.melds;
  game.deck = restored.deck;
  game.discard = restored.discard;
  game.currentPlayerIndex = restored.currentPlayerIndex;
  game.movesMade = restored.movesMade;
  game.hasDrawn = false;
  game.thankYou = null;
  // 같은 카드를 다시 집었다 취소하는 걸 반복하면 차례가 영영 안 돌아간다.
  game.blockedThankYous.push(thankYouKey(pending.playerId, pending.cardId));
};

export interface HulaStopResult {
  /** 스톱을 부른 사람의 손패 점수. */
  points: number;
  /** 더 낮거나 같은 손패를 들고 있어 스톱을 잡은 사람이 있었는지. */
  caught: boolean;
}

/**
 * 스톱을 부른다. 손패 점수가 상한 이하이고 아직 이번 차례에 카드를 가져오지
 * 않았을 때만 부를 수 있다. 부른 즉시 판이 끝나고 등수가 확정된다 — 나보다
 * 낮거나 같은 손패가 있으면 그 사람이 1등, 나는 꼴등이다.
 * @param room - 대상 방
 * @param requesterId - 요청한 게스트 id
 * @returns 손패 점수와 잡혔는지 여부
 */
export const callHulaStop = (room: RoomState, requesterId: string): HulaStopResult => {
  const game = asHulaGame(room);
  assertTurn(room, game, requesterId);
  if (game.hasDrawn) throw new Error("카드를 가져온 뒤에는 스톱할 수 없습니다.");

  const points = hulaHandPoints(game.hands[requesterId]);
  if (points > HULA_STOP_MAX_POINTS) {
    throw new Error(`손패 합이 ${HULA_STOP_MAX_POINTS} 이하일 때만 스톱할 수 있습니다.`);
  }

  game.stoppedByUserId = requesterId;

  const standings = buildStandings(room, game);
  const stopper = standings.find((s) => s.userId === requesterId) as HulaStanding;
  const others = standings.filter((s) => s.userId !== requesterId);
  const catchers = others.filter((s) => s.points <= points);
  const missed = others.filter((s) => s.points > points);

  const groups =
    catchers.length > 0
      ? [[...catchers].sort(byPointsThenCount), ...splitByRegistered(missed), [stopper]]
      : [[stopper], ...splitByRegistered(others)];

  settleScores(game, standings, groups);
  game.winnerUserId = firstPlaceOf(game.ranks ?? {});
  return { points, caught: catchers.length > 0 };
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
  clearThankYouIfUsed(game, requesterId);

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
  clearThankYouIfUsed(game, requesterId);

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
 * 땡큐로 가져온 카드를 아직 쓰지 않았다면 버릴 수 없다 — 취소만 가능하다.
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
  if (game.thankYou) throw new Error("땡큐한 카드를 먼저 조합에 써야 합니다.");

  const hand = game.hands[requesterId];
  const [card] = takeCards(hand, [cardId]);
  removeFromHand(hand, [card]);
  game.discard.push(card);
  game.movesMade += 1;

  if (settleIfFinished(room, game, requesterId)) {
    return { discarded: card, gameOver: true };
  }

  beginTurn(game, (game.currentPlayerIndex + 1) % room.players.length);
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
 * 결과 저장용으로 플레이어의 등수를 돌려준다.
 * @param room - 대상 방
 * @param userId - 대상 플레이어
 * @returns 등수(1부터)
 */
export const hulaRankOf = (room: RoomState, userId: string): number => {
  const { ranks } = asHulaGame(room);
  return ranks?.[userId] ?? room.players.length;
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
  /** 보는 사람 본인의 손패, 그리고 판이 끝난 뒤에는 모두의 손패가 담긴다. */
  hand: HulaCard[] | null;
  /** 자기 조합을 하나라도 등록했는지 (붙이기 가능 여부). */
  registered: boolean;
  /** 종료 후 확정된 손패 점수. 진행 중에는 null. */
  points: number | null;
  /** 종료 후 확정된 등수. 진행 중에는 null. */
  rank: number | null;
}

export interface PublicHulaGameState {
  type: "HULA";
  deckCount: number;
  discard: HulaCard[];
  melds: HulaMeld[];
  currentPlayerId: string | null;
  hasDrawn: boolean;
  /** 아직 쓰지 않은 땡큐 카드. 이 카드가 남아 있으면 버릴 수 없다. */
  thankYou: HulaThankYou | null;
  winnerUserId: string | null;
  stoppedByUserId: string | null;
  hulaUserId: string | null;
  /** 판이 끝나 모두의 손패가 공개된 상태인지. */
  revealed: boolean;
  movesMade: number;
  players: PublicHulaPlayer[];
}

/**
 * 클라이언트로 보낼 수 있는 형태로 훌라 게임 상태를 가공한다. 진행 중에는
 * 보는 사람 본인의 손패만 실제 값을 보내고, 판이 끝나면 모두 공개한다.
 * @param room - 대상 방
 * @param forUserId - 이 상태를 받을 플레이어
 * @returns 클라이언트용 훌라 게임 상태
 */
export const publicHulaGameState = (
  room: RoomState,
  forUserId: string,
): PublicHulaGameState => {
  const game = asHulaGame(room);
  const revealed = game.winnerUserId !== null;

  return {
    type: "HULA",
    deckCount: game.deck.length,
    discard: game.discard,
    melds: game.melds,
    currentPlayerId: currentPlayerId(room, game),
    hasDrawn: game.hasDrawn,
    thankYou: game.thankYou,
    winnerUserId: game.winnerUserId,
    stoppedByUserId: game.stoppedByUserId,
    hulaUserId: game.hulaUserId,
    revealed,
    movesMade: game.movesMade,
    players: room.players.map((player) => ({
      userId: player.userId,
      handCount: game.hands[player.userId]?.length ?? 0,
      hand:
        player.userId === forUserId || revealed
          ? sortHulaHand(game.hands[player.userId] ?? [])
          : null,
      registered: game.melds.some((meld) => meld.ownerId === player.userId),
      points: game.scores?.[player.userId] ?? null,
      rank: game.ranks?.[player.userId] ?? null,
    })),
  };
};
