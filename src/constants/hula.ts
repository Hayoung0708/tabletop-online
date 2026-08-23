/**
 * 차례가 넘어간 뒤 덱에서 카드를 가져올 수 있게 되기까지의 지연(ms).
 * 이 사이에 다른 사람이 더미를 가져가(땡큐) 차례를 뺏을 수 있다.
 */
export const HULA_DECK_DRAW_DELAY_MS = 500;

/** 스톱을 부를 수 있는 손패 점수 상한. */
export const HULA_STOP_MAX_POINTS = 11;

/** 게임이 끝난 뒤 상대 손패를 한 장씩 뒤집는 간격(ms). */
export const HULA_REVEAL_STAGGER_MS = 120;

/** 손패 한 장을 뒤집는 데 걸리는 시간(ms). */
export const HULA_REVEAL_DURATION_MS = 600;

/** 손패 공개 연출을 다 보여줄 때까지 결과 화면 전환을 미루는 시간(ms). */
export const HULA_REVEAL_HOLD_MS = 2200;
