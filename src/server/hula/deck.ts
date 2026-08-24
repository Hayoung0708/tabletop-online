import { SUITS, type Suit } from "@/server/shithead/deck";

/** 훌라 카드 랭크 — A가 가장 낮고(A-2-3), Q-K-A로는 잇지 못한다. */
export const HULA_RANKS = [
  "A",
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
] as const;
export type HulaRank = (typeof HULA_RANKS)[number];

export interface HulaCard {
  id: string;
  rank: HulaRank;
  suit: Suit;
}

/**
 * 점수 계산에 쓰는 랭크별 값 — A는 1, 숫자는 액면, J·Q·K는 11·12·13.
 * 7은 혼자서도 등록할 수 있어 손에 쥐고 있으면 손해가 커야 하므로 15로 센다.
 */
const PENALTY_POINTS: Record<HulaRank, number> = {
  A: 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 15,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 11,
  Q: 12,
  K: 13,
};

/**
 * 조커 없는 표준 52장 덱을 만든다.
 * @returns 셔플되지 않은 카드 52장
 */
export const createHulaDeck = (): HulaCard[] => {
  const deck: HulaCard[] = [];
  for (const suit of SUITS) {
    for (const rank of HULA_RANKS) {
      deck.push({ id: `${rank}-${suit}`, rank, suit });
    }
  }
  return deck;
};

/**
 * 이 카드의 벌점을 구한다.
 * @param card - 점수를 매길 카드
 * @returns 벌점
 */
export const hulaCardPoints = (card: HulaCard): number => PENALTY_POINTS[card.rank];

/**
 * 손패에 남은 카드의 벌점 합계를 구한다.
 * @param cards - 남은 카드들
 * @returns 벌점 합계
 */
export const hulaHandPoints = (cards: HulaCard[]): number =>
  cards.reduce((sum, card) => sum + hulaCardPoints(card), 0);

/**
 * 랭크의 순서 값(A가 0)을 구한다. 스트레이트가 이어지는지 볼 때 쓴다.
 * @param rank - 확인할 랭크
 * @returns 오름차순 인덱스
 */
export const hulaRankIndex = (rank: HulaRank): number => HULA_RANKS.indexOf(rank);

/**
 * 손패를 보기 좋게 정렬한다 — 무늬별로 묶고 무늬 안에서는 랭크 오름차순.
 * 카드 id는 그대로라 CardFan의 이동 애니메이션이 자연스럽게 이어진다.
 * @param cards - 정렬할 카드들
 * @returns 새로 정렬된 배열 (원본은 변경하지 않음)
 */
export const sortHulaHand = (cards: HulaCard[]): HulaCard[] =>
  [...cards].sort((a, b) => {
    if (a.suit !== b.suit) return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
    return hulaRankIndex(a.rank) - hulaRankIndex(b.rank);
  });
