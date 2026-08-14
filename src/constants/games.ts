export interface GameOption {
  id: string;
  label: string;
  desc: string;
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
    desc: "주사위 5개로 점수판을 채워, 총점이 높은 사람이 승리",
    icon: "/icons/yatzy.svg",
  },
  {
    id: "SHITHEAD",
    label: "싯헤드",
    desc: "볼 수 없는 바닥패를 깔고, 카드를 가장 먼저 다 내면 승리",
    icon: "/icons/shithead.svg",
  },
  {
    id: "ONECARD",
    label: "원카드",
    desc: "같은 무늬나 숫자를 이어 내고, 손패를 가장 먼저 다 내면 승리",
    icon: "/icons/onecard.svg",
  },
  {
    id: "HULA",
    label: "훌라",
    desc: "추후 업데이트 예정",
    icon: "/icons/hula.svg",
    disabled: true,
  },
];
