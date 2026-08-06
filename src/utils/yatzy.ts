/** 야찌 점수 항목 목록 (상단 6개 + 하단 7개) */
export const CATEGORIES = [
  "ones",
  "twos",
  "threes",
  "fours",
  "fives",
  "sixes",
  "threeKind",
  "fourKind",
  "fullHouse",
  "smallStraight",
  "largeStraight",
  "yahtzee",
  "chance",
] as const;

export type Category = (typeof CATEGORIES)[number];

export type Scorecard = Record<Category, number | null>;

/**
 * 모든 항목이 빈칸인 점수판을 만든다.
 * @returns 초기화된 점수판
 */
export const emptyScorecard = (): Scorecard => {
  return Object.fromEntries(CATEGORIES.map((category) => [category, null])) as Scorecard;
};

/**
 * 주사위 하나를 굴린다.
 * @returns 1~6 사이의 눈
 */
export const rollOne = (): number => {
  return Math.floor(Math.random() * 6) + 1;
};

/**
 * 주사위 여러 개를 굴린다.
 * @param count - 굴릴 주사위 개수
 * @returns 굴린 눈들의 배열
 */
export const rollDice = (count: number): number[] => {
  return Array.from({ length: count }, rollOne);
};

/**
 * 눈(1~6)별로 몇 개씩 나왔는지 센다. 인덱스 0은 사용하지 않는다.
 * @param dice - 주사위 눈 배열
 * @returns 눈 값별 개수 (길이 7)
 */
const countByFace = (dice: number[]): number[] => {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const face of dice) counts[face] += 1;
  return counts;
};

/**
 * 주사위 눈의 합을 구한다.
 * @param dice - 주사위 눈 배열
 * @returns 합계
 */
const sumOf = (dice: number[]): number => {
  return dice.reduce((total, face) => total + face, 0);
};

/**
 * 주어진 눈 값들이 모두 하나 이상씩 나왔는지 확인한다 (스트레이트 판정용).
 * @param counts - 눈 값별 개수
 * @param values - 연속으로 있어야 하는 눈 값 목록
 * @returns 모두 갖춰졌는지 여부
 */
const hasEachFace = (counts: number[], values: number[]): boolean => {
  return values.every((v) => counts[v] > 0);
};

/**
 * 주어진 항목과 주사위 조합으로 얻는 점수를 계산한다.
 * @param category - 점수를 매길 항목
 * @param dice - 현재 주사위 눈 배열
 * @returns 해당 항목의 점수
 */
export const calculateScore = (category: Category, dice: number[]): number => {
  const counts = countByFace(dice);

  switch (category) {
    case "ones":
      return counts[1] * 1;
    case "twos":
      return counts[2] * 2;
    case "threes":
      return counts[3] * 3;
    case "fours":
      return counts[4] * 4;
    case "fives":
      return counts[5] * 5;
    case "sixes":
      return counts[6] * 6;
    case "threeKind":
      return counts.some((n) => n >= 3) ? sumOf(dice) : 0;
    case "fourKind":
      return counts.some((n) => n >= 4) ? sumOf(dice) : 0;
    case "fullHouse":
      return counts.includes(3) && counts.includes(2) ? 25 : 0;
    case "smallStraight": {
      const isSmall =
        hasEachFace(counts, [1, 2, 3, 4]) ||
        hasEachFace(counts, [2, 3, 4, 5]) ||
        hasEachFace(counts, [3, 4, 5, 6]);
      return isSmall ? 30 : 0;
    }
    case "largeStraight": {
      const isLarge =
        hasEachFace(counts, [1, 2, 3, 4, 5]) || hasEachFace(counts, [2, 3, 4, 5, 6]);
      return isLarge ? 40 : 0;
    }
    case "yahtzee":
      return counts.some((n) => n === 5) ? 50 : 0;
    case "chance":
      return sumOf(dice);
  }
};

/** 상단(1~6) 항목 6개 이름 */
const UPPER_CATEGORIES = ["ones", "twos", "threes", "fours", "fives", "sixes"] as const;

/**
 * 상단 항목(1~6) 점수 합을 구한다.
 * @param scorecard - 점수판
 * @returns 상단 합계
 */
export const upperTotal = (scorecard: Scorecard): number => {
  return UPPER_CATEGORIES.map((category) => scorecard[category] ?? 0).reduce(
    (total, score) => total + score,
    0,
  );
};

/**
 * 상단 합계가 63점 이상이면 보너스 35점을 반환한다.
 * @param scorecard - 점수판
 * @returns 보너스 점수 (0 또는 35)
 */
export const upperBonus = (scorecard: Scorecard): number => {
  return upperTotal(scorecard) >= 63 ? 35 : 0;
};

/**
 * 보너스를 포함한 전체 총점을 구한다.
 * @param scorecard - 점수판
 * @returns 총점
 */
export const totalScore = (scorecard: Scorecard): number => {
  const base = CATEGORIES.map((category) => scorecard[category] ?? 0).reduce(
    (total, score) => total + score,
    0,
  );
  return base + upperBonus(scorecard);
};
