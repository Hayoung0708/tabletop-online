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

/** 바닥패를 뒤집을 때, 뒤집히는 동작 절반(닫힘 또는 열림)의 시간(ms). */
export const FACE_DOWN_FLIP_HALF_MS = 180;

/** 바닥패가 뒤집히는 전체 시간(ms, 닫힘+열림). */
export const FACE_DOWN_FLIP_MS = FACE_DOWN_FLIP_HALF_MS * 2;

/** 바닥패가 뒤집힌 채로 앞면을 보여주는 시간(ms). 이 시간이 지나야 실제로 반영된다. */
export const FACE_DOWN_HOLD_MS = 1000;

/** 게임이 끝나는 마지막 패를 낸 뒤, 결과 화면으로 넘어가기 전 잠깐 멈추는 시간(ms). */
export const GAME_OVER_HOLD_MS = 1000;

/** 카드 내는 소리를 착지 시각보다 먼저 재생하는 리드 타임(ms) — 착지 순간에 맞춰 들리게 보정. */
export const PLACE_SOUND_LEAD_MS = 180;

/**
 * 손패 보충(리필) 소리를 비행 시작보다 늦게 재생하는 지연(ms). 리필 비행은
 * 낸 카드가 착지하기 전(HAND_SHIFT_MS)에 시작하므로, 그대로 틀면 착지 소리와
 * 겹친다 — 착지(비행 600ms) 직후로 밀어서 "탁(착지) → 슥(보충)"으로 분리한다.
 */
export const REFILL_SOUND_DELAY_MS = 300;

/** 더미가 다 쌓인 모습을 보여준 채로 유지하는 시간(ms) — 이 시간이 지나야 태운다. */
export const BURN_HOLD_MS = 250;

/** 더미가 타서 사라지는 연출 시간(ms). */
export const BURN_VANISH_MS = 400;

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
