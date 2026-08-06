import { CATEGORIES, type Category } from "@/utils/yatzy";

/** 항목 코드 → 화면에 보여줄 한글 라벨 */
export const CATEGORY_LABELS: Record<Category, string> = {
  ones: "1",
  twos: "2",
  threes: "3",
  fours: "4",
  fives: "5",
  sixes: "6",
  threeKind: "트리플",
  fourKind: "포카드",
  fullHouse: "풀하우스",
  smallStraight: "스몰 스트레이트",
  largeStraight: "라지 스트레이트",
  yahtzee: "야찌",
  chance: "찬스",
};

export const UPPER_CATEGORIES = CATEGORIES.slice(0, 6);
export const LOWER_CATEGORIES = CATEGORIES.slice(6);

/**
 * 점수 셀 하나의 기본 스타일. 버튼/고정값/빈칸 모두 같은 크기를 써서 내
 * 차례가 되어도 표가 늘어나거나 줄어들지 않게 한다.
 */
export const SCORE_CELL_BASE_CLASS =
  "inline-flex min-w-14 justify-center rounded-md border px-2.5 py-1 text-base font-semibold leading-snug";
