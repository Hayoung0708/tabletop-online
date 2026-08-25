/**
 * 카드 한 장의 크기 클래스. 화면이 좁으면 카드도 작아진다 — 싯헤드는 한 명이
 * 바닥패 3장 + 손패를 함께 차지해서, 큰 카드로는 휴대폰 폭에 들어가지 않는다.
 * (모바일 44×64 / sm 56×80 / md 이상 64×96)
 */
export const CARD_SIZE_CLASS = "h-16 w-11 sm:h-20 sm:w-14 md:h-24 md:w-16";

/** 카드가 놓일 빈 자리(점선 박스)의 크기 — 카드와 같은 크기로 맞춘다. */
export const CARD_SLOT_SIZE_CLASS = CARD_SIZE_CLASS;

/**
 * 카드 한 줄이 차지할 최소 높이. 카드 높이에 얼굴패가 살짝 겹쳐 나오는
 * 여백(10px)을 더한 값이라 카드가 없어도 줄 높이가 흔들리지 않는다.
 */
export const CARD_ROW_MIN_H_CLASS =
  "min-h-[4.625rem] sm:min-h-[5.625rem] md:min-h-[6.625rem]";

/**
 * 좁은 화면에서 오른쪽 아래에 떠 있는 감정표현 버튼(EmoteFab)이 손패 마지막
 * 장을 덮지 않도록 손패 줄 오른쪽에 비워 두는 여백. 마진이라 손패 폭 측정
 * (clientWidth)에는 포함되지 않아 겹침 계산이 어긋나지 않는다.
 */
export const HAND_FAB_CLEARANCE_CLASS = "mr-[3.75rem] lg:mr-0";
