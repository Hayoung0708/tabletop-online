/** 손패 부채꼴 배치 상수. 카드가 많아지면 손패 영역 폭 안에서 겹쳐 놓는다. */

/** 카드 한 장의 폭(px). sm 이상 기준(w-16). 실제보다 크게 잡아 넘침을 막는다. */
export const HAND_CARD_WIDTH_PX = 64;

/** 겹치지 않을 때 카드 사이 기본 간격(px). */
export const HAND_CARD_GAP_PX = 8;

/** 카드 이동 애니메이션 지속 시간(ms). */
export const CARD_FLIGHT_DURATION_MS = 600;

/** 여러 장을 연속으로 낼 때 카드 사이 시작 간격(ms). */
export const CARD_FLIGHT_STAGGER_MS = 170;

/** 바닥패 자리 수. */
export const FACE_DOWN_DEAL_SLOTS = 3;

/** 딜에서 손패로 날리는 카드 수(시작 손패 전체). */
export const HAND_DEAL_CARD_COUNT = 6;

/** 손패 카드 도착 간격(ms). 도착할 때마다 먼저 온 카드가 한 칸씩 오른쪽으로 밀린다. */
export const HAND_DEAL_INTRA_MS = 190;

/** 바닥패 슬롯에서 뒷카드가 컨테이너 상단으로부터 내려앉은 오프셋(px, top-2.5). */
export const FACE_DOWN_SLOT_TOP_PX = 10;

/** 손패에 카드가 새로 들어올 때 기존 카드가 옆으로 밀리는 시간(ms). */
export const HAND_SHIFT_MS = 320;

/** 바닥패 3자리를 돌린 뒤 손패 딜이 시작되는 시점(ms, 딜 시작 기준). */
export const HAND_PHASE_OFFSET_MS = FACE_DOWN_DEAL_SLOTS * CARD_FLIGHT_STAGGER_MS;

/**
 * 딜 애니메이션 전체가 끝나는 데 걸리는 시간(ms). 이 동안 실제 카드는 숨기고
 * 날아오는 카드만 보여서 "빈 자리에 채워지는" 느낌을 준다. 손패는 마지막 카드
 * 도착과 동시에 모든 카드의 밀림이 끝난다(j*간격 + 남은 밀림 = 상수).
 */
export const SHITHEAD_DEAL_TOTAL_MS =
  HAND_PHASE_OFFSET_MS +
  (HAND_DEAL_CARD_COUNT - 1) * HAND_DEAL_INTRA_MS +
  CARD_FLIGHT_DURATION_MS +
  150;

/** 시작 플레이어 안내 토스트가 나타난 뒤 사라지기 시작할 때까지의 시간(ms). */
export const STARTER_TOAST_MS = 2200;

/** 등장(animate.css bounceInUp) 재생 시간(ms). */
export const STARTER_TOAST_ENTER_MS = 900;

/**
 * 퇴장(animate.css bounceOutDown) 재생 시간(ms). animate.css의 bounceOut 계열은
 * 실제로 --animate-duration의 0.75배 동안 재생되므로, 토스트를 지우는 타이밍은
 * 넉넉하게 이 값 그대로 기다린다.
 */
export const STARTER_TOAST_EXIT_MS = 800;

/** DOM 앵커 이름 — 카드가 날아갈 출발/도착 지점을 찾는 데 쓴다. */
export const SHITHEAD_ANCHOR = {
  deck: "shithead-deck",
  pile: "shithead-pile",
  /**
   * 플레이어 카드 영역(전체) 앵커 이름.
   * @param userId - 플레이어 게스트 id
   * @returns 앵커 문자열
   */
  field: (userId: string): string => `shithead-field-${userId}`,
  /**
   * 플레이어 손패 영역 앵커 이름.
   * @param userId - 플레이어 게스트 id
   * @returns 앵커 문자열
   */
  hand: (userId: string): string => `shithead-hand-${userId}`,
  /**
   * 플레이어 바닥패 i번째 자리 앵커 이름.
   * @param userId - 플레이어 게스트 id
   * @param index - 바닥패 자리 번호(0부터)
   * @returns 앵커 문자열
   */
  faceDownSlot: (userId: string, index: number): string =>
    `shithead-fd-${userId}-${index}`,
} as const;
