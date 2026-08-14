import { SUITS, type Suit } from "@/server/shithead/deck";

export const ONE_CARD_RANKS = [
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
export type OneCardRank = (typeof ONE_CARD_RANKS)[number] | "JOKER";

export interface OneCard {
  id: string;
  rank: OneCardRank;
  /** 조커는 무늬가 없다(null). */
  suit: Suit | null;
}

/** 공격 카드별 누적 장수 — 2는 +2, A는 +3, 조커는 +5. */
const ATTACK_VALUES: Partial<Record<OneCardRank, number>> = {
  "2": 2,
  A: 3,
  JOKER: 5,
};

/**
 * 이 랭크가 공격 카드라면 다음 사람이 먹을 장수를, 아니면 0을 반환한다.
 * @param rank - 확인할 랭크
 * @returns 공격 장수
 */
export const attackValueOf = (rank: OneCardRank): number => ATTACK_VALUES[rank] ?? 0;

/**
 * 조커 2장을 포함한 원카드용 54장 덱을 만든다.
 * @returns 셔플되지 않은 카드 54장
 */
export const createOneCardDeck = (): OneCard[] => {
  const deck: OneCard[] = [];
  for (const suit of SUITS) {
    for (const rank of ONE_CARD_RANKS) {
      deck.push({ id: `${rank}-${suit}`, rank, suit });
    }
  }
  deck.push({ id: "JOKER-1", rank: "JOKER", suit: null });
  deck.push({ id: "JOKER-2", rank: "JOKER", suit: null });
  return deck;
};

/**
 * 지금 이 카드를 더미 위에 낼 수 있는지 판정한다.
 *
 * 공격이 쌓여 있으면(attackStack > 0) 반격 카드만 낼 수 있다: 조커는 언제나,
 * 다른 공격 카드(2/A)는 맨 위와 같은 랭크거나 같은 무늬일 때만. 조커 공격
 * 위에는 조커로만 반격할 수 있다.
 *
 * 평상시에는 같은 무늬 또는 같은 랭크를 낸다. 조커는 아무 때나 낼 수 있고,
 * 조커가 맨 위면 아무 카드나 낼 수 있다. 7로 무늬가 지정돼 있으면 그 무늬
 * 또는 7만 낼 수 있다.
 * @param top - 더미 맨 위 카드
 * @param card - 내려는 카드
 * @param declaredSuit - 7로 지정된 무늬 (없으면 null)
 * @param attackStack - 누적된 공격 장수
 * @returns 낼 수 있으면 true
 */
export const canPlayOneCard = (
  top: OneCard,
  card: OneCard,
  declaredSuit: Suit | null,
  attackStack: number,
): boolean => {
  if (attackStack > 0) {
    if (card.rank === "JOKER") return true;
    if (top.rank === "JOKER") return false;
    if (attackValueOf(card.rank) === 0) return false;
    return card.rank === top.rank || card.suit === top.suit;
  }

  if (card.rank === "JOKER") return true;
  if (top.rank === "JOKER") return true;
  if (declaredSuit) return card.suit === declaredSuit || card.rank === "7";
  return card.suit === top.suit || card.rank === top.rank;
};

/** 손패 화면 정렬용 랭크 순서 — A가 왼쪽, K 다음에 조커. */
const DISPLAY_ORDER: readonly OneCardRank[] = [...ONE_CARD_RANKS, "JOKER"];

/** 화면 정렬용 무늬 순서. */
const SUIT_DISPLAY_ORDER: Record<Suit, number> = {
  clubs: 0,
  diamonds: 1,
  hearts: 2,
  spades: 3,
};

/**
 * 손패를 화면에 보여줄 순서로 정렬한다. 랭크 오름차순(A~K, 조커는 맨
 * 오른쪽), 같은 랭크면 무늬 순.
 * @param cards - 정렬할 카드들
 * @returns 정렬된 새 배열 (원본은 바꾸지 않음)
 */
export const sortOneCardHand = (cards: readonly OneCard[]): OneCard[] =>
  [...cards].sort((a, b) => {
    const rankDiff = DISPLAY_ORDER.indexOf(a.rank) - DISPLAY_ORDER.indexOf(b.rank);
    if (rankDiff !== 0) return rankDiff;
    return (
      (a.suit ? SUIT_DISPLAY_ORDER[a.suit] : 9) -
      (b.suit ? SUIT_DISPLAY_ORDER[b.suit] : 9)
    );
  });
