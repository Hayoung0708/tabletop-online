"use client";

import { useEffect, useRef } from "react";

/**
 * 게임이 시작된 순간을 감지해 "○○부터 시작!" 안내를 한 번 띄운다. 안내를
 * 띄우는 함수는 화면(useCenterAnnounce)에서 받아 쓴다 — 같은 자리에 뜨는
 * 다른 안내(원카드 외치기 결과 등)와 슬롯을 나눠 쓰면 두 개가 겹쳐 보인다.
 * @param started - 게임이 막 시작됐는지 (싯헤드는 바닥패 선택 완료 시점)
 * @param starterName - 시작 플레이어 닉네임
 * @param showAnnounce - 가운데 안내를 띄우는 함수
 */
export const useStarterAnnounce = (
  started: boolean,
  starterName: string,
  showAnnounce: (text: string) => void,
): void => {
  const wasStarted = useRef(false);
  // 이름은 ref로 읽는다 — 토스트가 떠 있는 동안 턴이 넘어가 이름이 바뀌어도
  // 처음 잡은 시작 플레이어를 그대로 보여줘야 한다.
  const starterNameRef = useRef(starterName);
  useEffect(() => {
    starterNameRef.current = starterName;
  });

  useEffect(() => {
    if (!started) {
      wasStarted.current = false;
      return;
    }
    if (wasStarted.current) return;
    wasStarted.current = true;
    showAnnounce(`${starterNameRef.current}부터 시작!`);
  }, [started, showAnnounce]);
};
