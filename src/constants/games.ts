export interface GameOption {
  id: string;
  label: string;
  /** public/icons 아래의 아이콘 경로. */
  icon: string;
  /** 추후 업데이트 예정이라 아직 고를 수 없는 게임이면 true. */
  disabled?: boolean;
}

/** 로비에서 고를 수 있는 게임 목록 */
export const GAMES: readonly GameOption[] = [
  {
    id: "YATZY",
    label: "야찌",
    icon: "/icons/yatzy.svg",
  },
  {
    id: "SHITHEAD",
    label: "싯헤드",
    icon: "/icons/shithead.svg",
  },
  {
    id: "ONECARD",
    label: "원카드",
    icon: "/icons/onecard.svg",
  },
  {
    id: "HULA",
    label: "훌라",
    icon: "/icons/hula.svg",
  },
];
