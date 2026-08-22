import { hulaRankIndex, type HulaCard } from "@/server/hula/deck";

/** 등록할 수 있는 조합 종류 — 같은 숫자 묶음(SET), 같은 무늬 연속(RUN). */
export type HulaMeldKind = "SET" | "RUN";

/** 등록에 필요한 최소 장수. */
export const MIN_MELD_SIZE = 3;

/** 같은 숫자 묶음이 이 장수가 되면 더미째 사라진다(무늬가 넷뿐이라 더 못 붙는다). */
export const SET_COMPLETE_SIZE = 4;

export interface HulaMeld {
  id: string;
  /** 이 조합을 등록한 플레이어. */
  ownerId: string;
  kind: HulaMeldKind;
  /** RUN은 항상 랭크 오름차순으로 정렬해 둔다. */
  cards: HulaCard[];
}

/**
 * 카드들이 같은 숫자 묶음인지 확인한다.
 * @param cards - 확인할 카드들
 * @returns 같은 숫자면 true
 */
const isSet = (cards: HulaCard[]): boolean =>
  cards.every((card) => card.rank === cards[0].rank);

/**
 * 카드들이 같은 무늬의 연속인지 확인한다(정렬 여부와 무관).
 * @param cards - 확인할 카드들
 * @returns 같은 무늬 연속이면 true
 */
const isRun = (cards: HulaCard[]): boolean => {
  if (!cards.every((card) => card.suit === cards[0].suit)) return false;
  const indexes = cards.map((card) => hulaRankIndex(card.rank)).sort((a, b) => a - b);
  return indexes.every((value, i) => i === 0 || value === indexes[i - 1] + 1);
};

/**
 * 이 카드들이 7 한 장만으로 등록하는 경우인지 확인한다. 7은 혼자서도 내려놓을
 * 수 있고, 그 뒤로 같은 무늬 6·8을 양옆에 붙여 계속 이어갈 수 있다.
 * @param cards - 등록하려는 카드들
 * @returns 7 단독 등록이면 true
 */
export const isLoneSeven = (cards: HulaCard[]): boolean =>
  cards.length === 1 && cards[0].rank === "7";

/**
 * 카드 묶음이 등록 가능한 조합인지 판정한다. 7 한 장은 같은 무늬 연속(RUN)의
 * 시작점으로 등록돼, 양옆으로 6·8부터 이어 붙일 수 있다.
 * @param cards - 등록하려는 카드들
 * @returns 조합 종류, 조합이 아니면 null
 */
export const classifyMeld = (cards: HulaCard[]): HulaMeldKind | null => {
  if (isLoneSeven(cards)) return "RUN";
  if (cards.length < MIN_MELD_SIZE) return null;
  if (isSet(cards)) return "SET";
  if (isRun(cards)) return "RUN";
  return null;
};

/**
 * 조합을 화면에 보여줄 순서로 정렬한다 — RUN은 랭크 오름차순, SET은 그대로.
 * @param kind - 조합 종류
 * @param cards - 정렬할 카드들
 * @returns 정렬된 카드들
 */
export const sortMeldCards = (kind: HulaMeldKind, cards: HulaCard[]): HulaCard[] =>
  kind === "RUN"
    ? [...cards].sort((a, b) => hulaRankIndex(a.rank) - hulaRankIndex(b.rank))
    : [...cards];

/**
 * 이미 등록된 조합에 이 카드를 붙일 수 있는지 확인한다. SET은 같은 숫자를,
 * RUN은 양 끝에 이어지는 카드만 받는다. 붙이기에 한해 A와 K도 서로 이어
 * 붙일 수 있다(K 위에 A, A 아래에 K) — 등록할 때는 여전히 Q-K-A를 연속으로
 * 보지 않는다.
 * @param meld - 붙일 대상 조합
 * @param card - 붙이려는 카드
 * @returns 붙일 수 있으면 true
 */
export const canAppendToMeld = (meld: HulaMeld, card: HulaCard): boolean => {
  if (meld.kind === "SET") {
    return card.rank === meld.cards[0].rank && meld.cards.length < SET_COMPLETE_SIZE;
  }
  if (card.suit !== meld.cards[0].suit) return false;

  const lowRank = meld.cards[0].rank;
  const highRank = meld.cards[meld.cards.length - 1].rank;
  if (card.rank === "A" && highRank === "K") return true;
  if (card.rank === "K" && lowRank === "A") return true;

  const index = hulaRankIndex(card.rank);
  return index === hulaRankIndex(lowRank) - 1 || index === hulaRankIndex(highRank) + 1;
};

/**
 * 붙인 카드를 조합의 어느 끝에 놓을지 정해 새 카드 배열을 만든다. 랭크로 다시
 * 정렬하면 K 위에 붙인 A가 맨 앞으로 튀어 순서가 깨지므로, 이어지는 쪽 끝에
 * 직접 붙인다.
 * @param meld - 붙일 대상 조합
 * @param card - 붙이는 카드
 * @returns 새 카드 배열
 */
export const withAppendedCard = (meld: HulaMeld, card: HulaCard): HulaCard[] => {
  if (meld.kind === "SET") return [...meld.cards, card];

  const lowRank = meld.cards[0].rank;
  const highRank = meld.cards[meld.cards.length - 1].rank;
  if (card.rank === "K" && lowRank === "A") return [card, ...meld.cards];
  if (card.rank === "A" && highRank === "K") return [...meld.cards, card];

  return hulaRankIndex(card.rank) < hulaRankIndex(lowRank)
    ? [card, ...meld.cards]
    : [...meld.cards, card];
};

/**
 * 지금 고른 카드들에 이 카드를 더해도 조합이 될 여지가 있는지 확인한다.
 * 같은 숫자(SET)이거나, 같은 무늬로 빈틈 없이 이어지는(RUN) 경우만 허용한다.
 * 아직 3장이 안 돼도 "될 수 있는" 상태면 통과시킨다.
 * @param selected - 이미 고른 카드들
 * @param card - 더하려는 카드
 * @returns 같이 고를 수 있으면 true
 */
export const canSelectTogether = (selected: HulaCard[], card: HulaCard): boolean => {
  if (selected.length === 0) return true;

  const next = [...selected, card];
  if (next.every((c) => c.rank === next[0].rank)) return true;
  if (!next.every((c) => c.suit === next[0].suit)) return false;

  const indexes = next.map((c) => hulaRankIndex(c.rank)).sort((a, b) => a - b);
  return indexes.every((value, i) => i === 0 || value === indexes[i - 1] + 1);
};
