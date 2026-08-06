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

export function emptyScorecard(): Scorecard {
  return Object.fromEntries(CATEGORIES.map((c) => [c, null])) as Scorecard;
}

export function rollOne(): number {
  return Math.floor(Math.random() * 6) + 1;
}

export function rollDice(count: number): number[] {
  return Array.from({ length: count }, rollOne);
}

function counts(dice: number[]): number[] {
  const c = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) c[d]++;
  return c;
}

function sum(dice: number[]): number {
  return dice.reduce((a, b) => a + b, 0);
}

export function calculateScore(category: Category, dice: number[]): number {
  const c = counts(dice);

  switch (category) {
    case "ones":
      return c[1] * 1;
    case "twos":
      return c[2] * 2;
    case "threes":
      return c[3] * 3;
    case "fours":
      return c[4] * 4;
    case "fives":
      return c[5] * 5;
    case "sixes":
      return c[6] * 6;
    case "threeKind":
      return c.some((n) => n >= 3) ? sum(dice) : 0;
    case "fourKind":
      return c.some((n) => n >= 4) ? sum(dice) : 0;
    case "fullHouse":
      return c.includes(3) && c.includes(2) ? 25 : 0;
    case "smallStraight": {
      const has = (vals: number[]) => vals.every((v) => c[v] > 0);
      const isSmall =
        has([1, 2, 3, 4]) || has([2, 3, 4, 5]) || has([3, 4, 5, 6]);
      return isSmall ? 30 : 0;
    }
    case "largeStraight": {
      const has = (vals: number[]) => vals.every((v) => c[v] > 0);
      const isLarge = has([1, 2, 3, 4, 5]) || has([2, 3, 4, 5, 6]);
      return isLarge ? 40 : 0;
    }
    case "yahtzee":
      return c.some((n) => n === 5) ? 50 : 0;
    case "chance":
      return sum(dice);
  }
}

export function upperTotal(scorecard: Scorecard): number {
  return (["ones", "twos", "threes", "fours", "fives", "sixes"] as const)
    .map((c) => scorecard[c] ?? 0)
    .reduce((a, b) => a + b, 0);
}

export function upperBonus(scorecard: Scorecard): number {
  return upperTotal(scorecard) >= 63 ? 35 : 0;
}

export function totalScore(scorecard: Scorecard): number {
  const base = CATEGORIES.map((c) => scorecard[c] ?? 0).reduce(
    (a, b) => a + b,
    0
  );
  return base + upperBonus(scorecard);
}
