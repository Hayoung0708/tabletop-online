import { DICE_SOUND_COUNT, DICE_SOUND_POOL } from "@/constants/media";

/**
 * 주사위 굴리는 소리 후보 중 겹치지 않게 count개를 무작위로 고른다.
 * @param count - 필요한 소리 개수 (동시에 굴리는 주사위 수)
 * @returns 선택된 소리 파일 경로 배열
 */
export const pickRandomDiceSounds = (count: number): string[] => {
  const indices = Array.from({ length: DICE_SOUND_COUNT }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices
    .slice(0, Math.min(count, DICE_SOUND_COUNT))
    .map((i) => DICE_SOUND_POOL[i]);
};

/**
 * 오디오 파일 하나를 재생한다. 자동재생이 브라우저 정책으로 막혀도 조용히 무시한다.
 * @param src - 재생할 오디오 파일 경로
 */
export const playSound = (src: string): void => {
  new Audio(src).play().catch(() => {});
};

/** 같은 소리가 이 시간(ms) 안에 또 요청되면 무시한다. 카드 이동 간격(최소 170ms)보다 짧게 잡는다. */
const SOUND_DEDUPE_MS = 80;

/** 소리별 마지막 재생 시각(ms). */
const lastPlayedAt = new Map<string, number>();

/**
 * 같은 소리가 거의 동시에 여러 번 요청돼도 한 번만 재생한다. 여러 사람에게
 * 카드가 동시에 뿌려질 때처럼, 같은 순간의 소리가 겹쳐 커지는 걸 막는다.
 * @param src - 재생할 오디오 파일 경로
 */
export const playSoundOnce = (src: string): void => {
  const now = Date.now();
  if (now - (lastPlayedAt.get(src) ?? 0) < SOUND_DEDUPE_MS) return;
  lastPlayedAt.set(src, now);
  playSound(src);
};

/**
 * 오디오 소스 하나 또는 후보 목록을 받아 재생한다. 목록이면 무작위로 하나 고른다.
 * @param src - 오디오 파일 경로 또는 후보 목록
 */
export const playRandomSound = (src: string | readonly string[]): void => {
  const picked = Array.isArray(src) ? src[Math.floor(Math.random() * src.length)] : src;
  playSound(picked);
};

/**
 * 여러 주사위가 동시에 굴러가는 소리를 재생한다.
 * @param diceCount - 굴러가는 주사위 개수
 */
export const playDiceRollSounds = (diceCount: number): void => {
  for (const src of pickRandomDiceSounds(diceCount)) {
    playSound(src);
  }
};
