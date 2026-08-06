export interface GameOption {
  id: string;
  label: string;
  desc: string;
  icon: string;
}

/** 로비에서 고를 수 있는 게임 목록 */
export const GAMES: readonly GameOption[] = [
  { id: "YATZY", label: "야찌", desc: "주사위 5개, 13턴 점수 대결", icon: "🎲" },
  {
    id: "SHITHEAD",
    label: "싯헤드",
    desc: "카드 52장, 제일 먼저 다 내면 승리",
    icon: "🃏",
  },
];
