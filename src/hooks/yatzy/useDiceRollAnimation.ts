"use client";

import { useEffect, useRef, useState } from "react";
import { ROLL_ANIMATION_MS, YAHTZEE_SOUND_SRC } from "@/constants/media";
import { playDiceRollSounds, playSound } from "@/utils/sound";
import type { PublicYatzyGameState } from "@/server/yatzy/gameLogic";

const EMPTY_MASK = [false, false, false, false, false];

export interface UseDiceRollAnimationResult {
  rollingMask: boolean[];
  randomFaces: number[];
  isRolling: boolean;
}

/**
 * 실제로 주사위를 굴렸을 때만(게임이 PLAYING으로 바뀌는 시점은 제외) 굴리는
 * 소리를 재생하고, 잠깐 눈을 무작위로 바꿔가며 텀블 애니메이션을 보여준다.
 * 애니메이션이 끝나는 시점에 야찌가 떴으면 onYahtzeeRoll을 호출한다.
 * @param game - 현재 야찌 게임 상태 (rollsLeft, dice, held를 관찰)
 * @param onYahtzeeRoll - 굴림이 끝났을 때 5개가 모두 같은 눈이면 호출되는 콜백
 * @returns 굴리는 중인 주사위 마스크, 굴리는 동안 보여줄 임시 눈, 굴리는 중 여부
 */
export const useDiceRollAnimation = (
  game: PublicYatzyGameState | null,
  onYahtzeeRoll: () => void,
): UseDiceRollAnimationResult => {
  const [rollingMask, setRollingMask] = useState<boolean[]>(EMPTY_MASK);
  const [randomFaces, setRandomFaces] = useState<number[]>([1, 1, 1, 1, 1]);
  const prevRollsLeftRef = useRef<number | null>(null);

  useEffect(() => {
    if (!game) return;

    const rolled =
      prevRollsLeftRef.current !== null && game.rollsLeft < prevRollsLeftRef.current;

    prevRollsLeftRef.current = game.rollsLeft;
    if (!rolled) return;

    const isYahtzeeRoll = game.dice.every((d) => d === game.dice[0]);
    const mask = game.held.map((held) => !held);
    let cancelled = false;

    const tumbleInterval = setInterval(() => {
      if (cancelled) return;
      setRandomFaces(mask.map((m) => (m ? 1 + Math.floor(Math.random() * 6) : 1)));
    }, 90);

    const finishTimeout = setTimeout(() => {
      if (cancelled) return;
      clearInterval(tumbleInterval);
      setRollingMask(EMPTY_MASK);
      if (isYahtzeeRoll) {
        onYahtzeeRoll();
        playSound(YAHTZEE_SOUND_SRC);
      }
    }, ROLL_ANIMATION_MS);

    const diceCount = mask.filter(Boolean).length;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setRollingMask(mask);
      playDiceRollSounds(diceCount);
    });

    return (): void => {
      cancelled = true;
      clearInterval(tumbleInterval);
      clearTimeout(finishTimeout);
    };
    // room_state가 올 때마다(다른 플레이어의 홀드 토글 등)가 아니라 실제로
    // 굴렸을 때만 다시 실행되어야 해서 rollsLeft만 의존성으로 둔다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.rollsLeft]);

  return { rollingMask, randomFaces, isRolling: rollingMask.some(Boolean) };
};
