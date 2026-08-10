"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from "react";
import { getSocket } from "@/lib/socket";
import { SHITHEAD_DEAL_TOTAL_MS } from "@/constants/shithead";

const DealingContext = createContext(false);

/** 실제 딜(앵커 준비 후 비행 시작)이 안 잡혔을 때를 대비한 여유 시간(ms). */
const DEAL_FALLBACK_EXTRA_MS = 800;

/**
 * 지금 딜 애니메이션이 진행 중인지 여부를 읽는다. true인 동안에는 실제 카드를
 * 숨기고 날아오는 카드만 보여, 빈 자리에 카드가 채워지는 연출을 만든다.
 * @returns 딜 진행 중이면 true
 */
export const useDealing = (): boolean => useContext(DealingContext);

export interface DealingProviderProps {
  children: ReactNode;
}

/**
 * shithead_deal 소켓 이벤트에 카드를 숨기기 시작하고, 오버레이가 실제 비행을
 * 시작할 때 쏘는 shithead_deal_start DOM 이벤트 기준으로 리빌 시점을 다시
 * 맞춘다(앵커 준비 재시도만큼 비행이 늦게 시작할 수 있어서). 보드가 그려지기
 * 전에 이벤트가 올 수 있어 WAITING 단계부터 계속 마운트돼 있어야 한다.
 * @param props - 자식 엘리먼트
 * @param props.children
 * @returns 딜 상태를 내려주는 프로바이더
 */
export const DealingProvider = ({ children }: DealingProviderProps): JSX.Element => {
  const [dealing, setDealing] = useState(false);
  const revealTimer = useRef<number | null>(null);

  useEffect(() => {
    const socket = getSocket();

    /**
     * 기존 리빌 타이머를 지우고 ms 뒤에 리빌하도록 다시 건다.
     * @param ms - 리빌까지 남은 시간
     */
    const scheduleReveal = (ms: number): void => {
      if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
      revealTimer.current = window.setTimeout(() => setDealing(false), ms);
    };

    /** 딜 소켓 이벤트 — 즉시 카드를 숨기고, 넉넉한 예비 리빌 타이머를 건다. */
    const onDeal = (): void => {
      setDealing(true);
      scheduleReveal(SHITHEAD_DEAL_TOTAL_MS + DEAL_FALLBACK_EXTRA_MS);
    };

    /** 실제 비행 시작 — 이 시점 기준으로 리빌 타이머를 정확히 다시 맞춘다. */
    const onDealStart = (): void => {
      scheduleReveal(SHITHEAD_DEAL_TOTAL_MS);
    };

    socket.on("shithead_deal", onDeal);
    window.addEventListener("shithead_deal_start", onDealStart);
    return (): void => {
      socket.off("shithead_deal", onDeal);
      window.removeEventListener("shithead_deal_start", onDealStart);
      if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    };
  }, []);

  return <DealingContext.Provider value={dealing}>{children}</DealingContext.Provider>;
};
