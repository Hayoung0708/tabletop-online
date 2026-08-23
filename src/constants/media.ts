/** 야찌 컨페티 애니메이션 파일 */
export const YAHTZEE_ANIMATION_SRC = "/lottie/yahtzee-success.json";
/** 야찌 성공 효과음 */
export const YAHTZEE_SOUND_SRC = "/sounds/yahtzee-success.mp3";

/** 덱에서 카드를 뽑을 때 나는 소리 (첫 딜, 손패 보충) */
export const CARD_TAKE_FROM_DECK_SOUND_SRC = "/sounds/shithead/take-from-deck.mp3";
/** 더미를 통째로 주워올 때 나는 소리 */
export const CARD_TAKE_FROM_PILE_SOUND_SRC = "/sounds/shithead/take-from-pile.mp3";
/** 카드를 더미에 내려놓을 때 나는 소리 */
export const CARD_PLACE_SOUND_SRC = "/sounds/shithead/place-card.mp3";

/** 준비된 주사위 굴리는 소리 개수 */
export const DICE_SOUND_COUNT = 13;

/** 주사위 굴리는 소리 후보 목록 */
export const DICE_SOUND_POOL: readonly string[] = Array.from(
  { length: DICE_SOUND_COUNT },
  (_, i) => `/sounds/dice-rolls/dice-${String(i + 1).padStart(2, "0")}.mp3`,
);

export interface EmoteDef {
  id: string;
  /** 버튼에 hover했을 때 뜨는 이름(title). */
  label: string;
  /** 사이드바 버튼에 쓸 아이콘. "/"로 시작하면 이미지, 아니면 이모지 텍스트. */
  icon: string;
  /** 클릭 시 띄울 영상/이미지 (webm 또는 gif). 참가자 카드의 정사각형 슬롯 안에 꽉 채워진다. */
  media: string;
  /** 같이 재생할 효과음. 여러 개면 매번 무작위로 하나 고른다. 없으면 무음. */
  audio?: string | readonly string[];
  /** 효과음 음량(0~1). 없으면 원본 그대로. */
  audioVolume?: number;
  /** 연속 전송 최소 간격(ms). 그동안 버튼이 비활성화된다. 없으면 제한 없음. */
  cooldownMs?: number;
  /** 슬롯 대비 재생 크기 배율. 카드 레이아웃(슬롯 크기)에는 영향 없이 시각적으로만 커진다. 기본 1배(슬롯에 꽉 참). */
  displayScale?: number;
  /** 슬롯 중심 기준 세로 오프셋(px). 음수면 위로. 기본 0. */
  offsetYPx?: number;
}

/** 사용 가능한 감정표현 목록. 순서대로 사이드바에 버튼이 그려진다. */
export const EMOTES: readonly EmoteDef[] = [
  {
    id: "emote-01",
    label: "?",
    icon: "❓",
    media: "/emotes/emote-01.webm",
    audio: "/emotes/emote-01.m4a",
    cooldownMs: 100,
    displayScale: 3.5,
    offsetYPx: -12,
  },
  {
    id: "emote-02-happy",
    label: "좋아요",
    icon: "/emotes/emote-02-happy.png",
    media: "/emotes/emote-02-happy.gif",
    audio: [
      "/emotes/happy-sound-1.wav",
      "/emotes/happy-sound-2.wav",
      "/emotes/happy-sound-3.wav",
    ],
    audioVolume: 0.5,
    cooldownMs: 2000,
  },
  {
    id: "emote-03-sad",
    label: "으앙",
    icon: "/emotes/emote-03-sad.png",
    media: "/emotes/emote-03-sad.gif",
    audio: ["/emotes/sad-sound-1.wav", "/emotes/sad-sound-2.wav"],
    audioVolume: 0.5,
    cooldownMs: 2000,
  },
];

/** 참가자 카드 레이아웃이 차지하는 정사각형 슬롯 한 변의 길이(rem) — 카드 크기는 이 값으로 고정된다. */
export const EMOTE_SLOT_SIZE_REM = 3.5;

/** gif 감정표현을 화면에서 지우기까지 걸리는 시간(ms) — gif는 재생 종료 이벤트가 없어 고정값을 쓴다. */
export const GIF_EMOTE_DURATION_MS = 2500;

/** 주사위 굴리는 소리 클립 길이와 맞춘 텀블 애니메이션 지속 시간(ms) */
export const ROLL_ANIMATION_MS = 700;
