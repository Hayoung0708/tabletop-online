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

/**
 * 여러 주사위가 동시에 굴러가는 소리를 재생한다.
 * @param diceCount - 굴러가는 주사위 개수
 */
export const playDiceRollSounds = (diceCount: number): void => {
  for (const src of pickRandomDiceSounds(diceCount)) {
    playSound(src);
  }
};
