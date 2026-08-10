export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = [
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
  "2",
] as const;
export type Rank = (typeof RANKS)[number];

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
}

/** 일반 카드(2, 10 제외) 랭크의 오름차순 순서 — 인덱스가 낮을수록 약함 */
const NORMAL_RANK_ORDER: readonly Rank[] = [
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "J",
  "Q",
  "K",
  "A",
];

/** 더미 맨 위에 몇 장이 쌓이면 자동으로 태우는지 */
const BURN_STACK_SIZE = 4;

/**
 * 카드 랭크가 어떤 카드 위에도 낼 수 있는 와일드(2, 7, 10)인지 확인한다.
 * 7은 내는 조건만 와일드이고, 낸 뒤 다음 사람이 봐야 할 기준은
 * getEffectiveTopCard가 따로 처리한다(7 아래 카드 기준).
 * @param rank - 확인할 랭크
 * @returns 와일드 여부
 */
export const isWildRank = (rank: Rank): boolean =>
  rank === "2" || rank === "7" || rank === "10";

/**
 * 조커 없는 표준 52장 덱을 만든다.
 * @returns 셔플되지 않은 카드 52장
 */
export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: `${rank}-${suit}`, rank, suit });
    }
  }
  return deck;
};

/**
 * 카드 배열을 무작위로 섞는다 (Fisher-Yates).
 * @param cards - 섞을 카드 배열
 * @returns 새로 섞인 배열 (원본은 변경하지 않음)
 */
export const shuffleCards = (cards: Card[]): Card[] => {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/** 시작 우선순위 비교용 무늬 순서 (낮을수록 우선) — 클로버 < 다이아 < 하트 < 스페이드 */
const SUIT_STARTING_ORDER: Record<Suit, number> = {
  clubs: 0,
  diamonds: 1,
  hearts: 2,
  spades: 3,
};

/** 손패 화면 정렬용 랭크 오름차순 순서 — 2가 가장 왼쪽, A가 가장 오른쪽 (게임 규칙상 세기와는 무관한 단순 숫자 순서). */
const DISPLAY_RANK_ORDER: readonly Rank[] = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

/**
 * 손패를 화면에 보여줄 순서로 정렬한다. 랭크가 낮을수록(2가 최저) 왼쪽에
 * 오고, 같은 랭크면 무늬 순(클로버<다이아<하트<스페이드)으로 나열해 매번
 * 같은 배치가 나온다.
 * @param cards - 정렬할 카드들
 * @returns 정렬된 새 배열 (원본은 바꾸지 않음)
 */
export const sortHandForDisplay = (cards: readonly Card[]): Card[] =>
  [...cards].sort((a, b) => {
    const rankDiff =
      DISPLAY_RANK_ORDER.indexOf(a.rank) - DISPLAY_RANK_ORDER.indexOf(b.rank);
    if (rankDiff !== 0) return rankDiff;
    return SUIT_STARTING_ORDER[a.suit] - SUIT_STARTING_ORDER[b.suit];
  });

/**
 * 두 카드의 시작 우선순위를 비교한다. 랭크가 낮을수록(3이 최저)
 * 우선하고, 랭크가 같으면 클로버<다이아<하트<스페이드 순으로 우선한다.
 * @param a - 비교할 카드
 * @param b - 비교할 카드
 * @returns a가 더 우선이면 음수, b가 더 우선이면 양수, 같으면 0
 */
const compareStartingPriority = (a: Card, b: Card): number => {
  const rankDiff = NORMAL_RANK_ORDER.indexOf(a.rank) - NORMAL_RANK_ORDER.indexOf(b.rank);
  if (rankDiff !== 0) return rankDiff;
  return SUIT_STARTING_ORDER[a.suit] - SUIT_STARTING_ORDER[b.suit];
};

/**
 * 카드 묶음 중 시작 우선순위가 가장 낮은 카드를 찾는다. 2/10은 와일드라
 * 시작 카드 후보에서 제외한다.
 * @param cards - 후보 카드들
 * @returns 가장 낮은 카드, 후보(비와일드 카드)가 없으면 null
 */
const findLowestStartingCard = (cards: readonly Card[]): Card | null => {
  const candidates = cards.filter((c) => !isWildRank(c.rank));
  if (candidates.length === 0) return null;
  return candidates.reduce((lowest, c) =>
    compareStartingPriority(c, lowest) < 0 ? c : lowest,
  );
};

/**
 * 플레이어별 카드 묶음 중, 시작 우선순위가 가장 낮은 카드를 든 사람의
 * 인덱스를 찾는다 (3이 최저, 동랭크면 클로버<다이아<하트<스페이드 —
 * "클로버 3을 가장 낮은 카드로 친다" 규칙의 일반화. 클로버 3이 아직
 * 배분되지 않은 채로 덱에 남아있을 수도 있어서, 정확히 클로버 3만
 * 찾지 않고 배분된 카드 중 가장 낮은 걸 찾아야 한다). 아무도 비와일드
 * 카드를 갖고 있지 않으면(있을 수 없지만) -1.
 * @param playersCards - 플레이어별 후보 카드 배열 (players 배열과 같은 순서)
 * @returns 시작 플레이어의 인덱스, 없으면 -1
 */
export const findStarterIndex = (playersCards: readonly (readonly Card[])[]): number => {
  let bestIndex = -1;
  let bestCard: Card | null = null;

  playersCards.forEach((cards, i) => {
    const lowest = findLowestStartingCard(cards);
    if (!lowest) return;
    if (!bestCard || compareStartingPriority(lowest, bestCard) < 0) {
      bestCard = lowest;
      bestIndex = i;
    }
  });

  return bestIndex;
};

/**
 * 더미에서 다음 사람이 실제로 비교해야 할 "유효한 맨 위 카드"를 구한다.
 * 7은 투명카드라 위에서부터 연속된 7을 건너뛰고, 그 결과가 2(리셋)이거나
 * 더미가 비어있으면(혹은 전부 7이면) 아무 카드나 낼 수 있다는 뜻으로 null.
 * @param pile - 현재 버려진 더미 (배열 끝이 맨 위)
 * @returns 비교 기준 카드, 없으면(아무거나 가능) null
 */
export const getEffectiveTopCard = (pile: readonly Card[]): Card | null => {
  for (let i = pile.length - 1; i >= 0; i--) {
    const card = pile[i];
    if (card.rank !== "7") {
      return card.rank === "2" ? null : card;
    }
  }
  return null;
};

/**
 * 카드 한 장을 지금 더미 위에 낼 수 있는지 판정한다.
 * @param pile - 현재 버려진 더미
 * @param card - 내려는 카드
 * @returns 낼 수 있으면 true
 */
export const canPlaySingleCard = (pile: readonly Card[], card: Card): boolean => {
  if (isWildRank(card.rank)) return true;

  const effectiveTop = getEffectiveTopCard(pile);
  if (!effectiveTop) return true;

  return (
    NORMAL_RANK_ORDER.indexOf(card.rank) >= NORMAL_RANK_ORDER.indexOf(effectiveTop.rank)
  );
};

/**
 * 같은 랭크 카드 여러 장을 한 번에 낼 수 있는지 판정한다.
 * @param pile - 현재 버려진 더미
 * @param cards - 내려는 카드들 (전부 같은 랭크여야 함)
 * @returns 낼 수 있으면 true
 */
export const canPlayCards = (pile: readonly Card[], cards: readonly Card[]): boolean => {
  if (cards.length === 0) return false;
  const [first, ...rest] = cards;
  if (rest.some((c) => c.rank !== first.rank)) return false;
  return canPlaySingleCard(pile, first);
};

/**
 * 10을 냈는지, 혹은 같은 랭크가 맨 위에 4장 이상 쌓였는지 확인해 더미가
 * 타야 하는지 판정한다.
 * @param pile - 카드를 낸 뒤의 더미 상태
 * @returns 더미를 태워야 하면 true
 */
export const shouldBurnPile = (pile: readonly Card[]): boolean => {
  if (pile.length === 0) return false;
  const topRank = pile[pile.length - 1].rank;
  if (topRank === "10") return true;

  if (pile.length < BURN_STACK_SIZE) return false;
  const topStack = pile.slice(pile.length - BURN_STACK_SIZE);
  return topStack.every((c) => c.rank === topRank);
};
