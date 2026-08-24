import { HULA_RANKS, hulaRankIndex, type HulaCard } from "@/server/hula/deck";

/** 등록할 수 있는 조합 종류 — 같은 숫자 묶음(SET), 같은 무늬 연속(RUN). */
export type HulaMeldKind = "SET" | "RUN";

/** 등록에 필요한 최소 장수. */
export const MIN_MELD_SIZE = 3;

/** 같은 숫자 묶음이 이 장수가 되면 더미째 사라진다(무늬가 넷뿐이라 더 못 붙는다). */
export const SET_COMPLETE_SIZE = 4;

/** 랭크 가짓수. 스트레이트는 A를 사이에 두고 K와 2가 이어지는 원형이다. */
const RANK_COUNT = HULA_RANKS.length;

export interface HulaMeld {
  id: string;
  /** 이 조합을 등록한 플레이어. */
  ownerId: string;
  kind: HulaMeldKind;
  /** RUN은 항상 낮은 끝 → 높은 끝 순서로 정렬해 둔다(K-A-2처럼 넘어가는 경우 포함). */
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
 * 랭크 인덱스들이 빈틈없이 한 줄로 이어지는지 보고, 이어지면 줄의 시작부터
 * 순서대로 늘어놓은 배열을 돌려준다. A는 K와 2를 잇는 자리라서(Q-K-A, K-A-2)
 * 인덱스는 원형으로 본다 — 그래서 단순 오름차순 정렬로는 판정할 수 없다.
 * @param indexes - 확인할 랭크 인덱스들
 * @returns 이어지는 순서대로 정렬된 인덱스, 이어지지 않으면 null
 */
const orderedRunIndexes = (indexes: number[]): number[] | null => {
  const unique = new Set(indexes);
  if (unique.size !== indexes.length || indexes.length > RANK_COUNT) return null;
  // 13장 전부면 어디가 시작인지 정할 수 없다 — 그냥 오름차순으로 둔다.
  if (indexes.length === RANK_COUNT) return [...indexes].sort((a, b) => a - b);

  // 바로 아래 랭크가 없는 카드가 줄의 시작이다.
  const start = indexes.find(
    (index) => !unique.has((index + RANK_COUNT - 1) % RANK_COUNT),
  );
  if (start === undefined) return null;

  const chain: number[] = [];
  for (let step = 0; step < indexes.length; step += 1) {
    const next = (start + step) % RANK_COUNT;
    if (!unique.has(next)) return null;
    chain.push(next);
  }
  return chain;
};

/**
 * 카드들이 같은 무늬의 연속인지 확인한다(정렬 여부와 무관).
 * @param cards - 확인할 카드들
 * @returns 같은 무늬 연속이면 true
 */
const isRun = (cards: HulaCard[]): boolean => {
  if (!cards.every((card) => card.suit === cards[0].suit)) return false;
  return orderedRunIndexes(cards.map((card) => hulaRankIndex(card.rank))) !== null;
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
 * 조합을 화면에 보여줄 순서로 정렬한다 — RUN은 이어지는 순서, SET은 그대로.
 * @param kind - 조합 종류
 * @param cards - 정렬할 카드들
 * @returns 정렬된 카드들
 */
export const sortMeldCards = (kind: HulaMeldKind, cards: HulaCard[]): HulaCard[] => {
  if (kind === "SET") return [...cards];

  const chain = orderedRunIndexes(cards.map((card) => hulaRankIndex(card.rank)));
  if (!chain) return [...cards];
  return chain.map(
    (index) => cards.find((card) => hulaRankIndex(card.rank) === index) as HulaCard,
  );
};

/**
 * RUN의 낮은 끝 바로 아래 랭크 인덱스.
 * @param meld - 대상 조합
 * @returns 랭크 인덱스
 */
const belowIndex = (meld: HulaMeld): number =>
  (hulaRankIndex(meld.cards[0].rank) + RANK_COUNT - 1) % RANK_COUNT;

/**
 * RUN의 높은 끝 바로 위 랭크 인덱스.
 * @param meld - 대상 조합
 * @returns 랭크 인덱스
 */
const aboveIndex = (meld: HulaMeld): number =>
  (hulaRankIndex(meld.cards[meld.cards.length - 1].rank) + 1) % RANK_COUNT;

/**
 * 이미 등록된 조합에 이 카드를 붙일 수 있는지 확인한다. SET은 같은 숫자를,
 * RUN은 양 끝에 이어지는 카드만 받는다. 랭크는 원형이라 K 위에 A, A 위에 2도
 * 이어진다.
 * @param meld - 붙일 대상 조합
 * @param card - 붙이려는 카드
 * @returns 붙일 수 있으면 true
 */
export const canAppendToMeld = (meld: HulaMeld, card: HulaCard): boolean => {
  if (meld.kind === "SET") {
    return card.rank === meld.cards[0].rank && meld.cards.length < SET_COMPLETE_SIZE;
  }
  if (card.suit !== meld.cards[0].suit) return false;
  if (meld.cards.length >= RANK_COUNT) return false;

  const index = hulaRankIndex(card.rank);
  return index === belowIndex(meld) || index === aboveIndex(meld);
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
  return hulaRankIndex(card.rank) === belowIndex(meld)
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
  return isRun(next);
};
