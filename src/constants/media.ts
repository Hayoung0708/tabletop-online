/** 야찌 컨페티 애니메이션 파일 */
export const YAHTZEE_ANIMATION_SRC = "/lottie/yahtzee-success.json";
/** 야찌 성공 효과음 */
export const YAHTZEE_SOUND_SRC = "/sounds/yahtzee-success.mp3";

/** 준비된 주사위 굴리는 소리 개수 */
export const DICE_SOUND_COUNT = 13;

/** 주사위 굴리는 소리 후보 목록 */
export const DICE_SOUND_POOL: readonly string[] = Array.from(
  { length: DICE_SOUND_COUNT },
  (_, i) => `/sounds/dice-rolls/dice-${String(i + 1).padStart(2, "0")}.mp3`,
);

// 감정표현은 아직 1종뿐이라 고정값으로 둔다. 여러 개가 생기면 풀 + 랜덤 선택으로 바꾼다.
export const EMOTE_VIDEO_SRC = "/emotes/emote-01.webm";
export const EMOTE_AUDIO_SRC = "/emotes/emote-01.m4a";

/** 주사위 굴리는 소리 클립 길이와 맞춘 텀블 애니메이션 지속 시간(ms) */
export const ROLL_ANIMATION_MS = 700;
