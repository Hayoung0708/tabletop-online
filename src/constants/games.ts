export interface GameOption {
  id: string;
  label: string;
  desc: string;
  icon: string;
}

/** 로비에서 고를 수 있는 게임 목록 (지금은 야찌 하나뿐) */
export const GAMES: readonly GameOption[] = [
  { id: "YATZY", label: "야찌", desc: "주사위 5개, 13턴 점수 대결", icon: "🎲" },
];
