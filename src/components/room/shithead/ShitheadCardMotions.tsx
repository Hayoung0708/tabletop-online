"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { getSocket } from "@/lib/socket";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import {
  CARD_FLIGHT_DURATION_MS,
  CARD_FLIGHT_STAGGER_MS,
  FACE_DOWN_DEAL_SLOTS,
  FACE_DOWN_SLOT_TOP_PX,
  SHITHEAD_DEAL_TOTAL_MS,
  SHITHEAD_ANCHOR,
} from "@/constants/shithead";
import type { Card } from "@/server/shithead/deck";

interface Anchor {
  cx: number;
  cy: number;
  h: number;
}

interface Flight {
  id: number;
  from: Anchor;
  to: Anchor;
  /** 앞면으로 보여줄 카드. null이면 뒷면(딜 연출). */
  card: Card | null;
  delayMs: number;
  /** 출발 시 기울기(deg). 딜 때 카드를 뿌리는 느낌을 준다. 0이면 회전 없음. */
  tiltDeg: number;
  /** true면 착지 후에도 사라지지 않고 붙잡아 둔다(딜: 리빌 순간 한꺼번에 제거). */
  hold: boolean;
}

let flightIdSeq = 0;
// 마지막으로 딜을 처리한 시각(ms). 이벤트가 중복 도착하거나 컴포넌트가 재구독돼도
// 딜 애니메이션이 두 번 재생되지 않도록, 딜 윈도우 안에 온 딜 이벤트는 무시한다.
let lastDealHandledAt = 0;

/**
 * data-anchor 엘리먼트의 화면상 중심 좌표와 높이를 구한다. 높이는 출발/도착
 * 카드 크기에 맞춰 날아가는 카드를 확대/축소하는 데 쓴다.
 * @param anchor - 앵커 이름
 * @returns 중심 좌표와 높이, 없으면 null
 */
const anchorRect = (anchor: string): Anchor | null => {
  const el = document.querySelector(`[data-anchor="${anchor}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return {
    cx: rect.left + rect.width / 2,
    cy: rect.top + rect.height / 2,
    h: rect.height,
  };
};

/**
 * 여러 앵커 후보 중 처음으로 존재하는 것의 사각형을 구한다.
 * @param anchors - 앵커 이름 후보들(우선순위 순)
 * @returns 첫 번째로 찾은 사각형, 없으면 null
 */
const firstAnchorRect = (anchors: string[]): Anchor | null => {
  for (const anchor of anchors) {
    const rect = anchorRect(anchor);
    if (rect) return rect;
  }
  return null;
};

/**
 * 바닥패 i번째 자리에 실제 뒷카드가 놓이는 정확한 중심/높이를 구한다. 슬롯
 * 컨테이너는 카드보다 위로 10px 크므로(top-2.5) 그만큼 보정해야 리빌 때 실제
 * 카드와 겹쳐 깜빡임이 없다.
 * @param playerId - 플레이어 게스트 id
 * @param index - 바닥패 자리 번호
 * @returns 카드 중심/높이, 없으면 null
 */
const slotLanding = (playerId: string, index: number): Anchor | null => {
  const rect = anchorRect(SHITHEAD_ANCHOR.faceDownSlot(playerId, index));
  if (!rect) return null;
  return {
    cx: rect.cx,
    cy: rect.cy + FACE_DOWN_SLOT_TOP_PX / 2,
    h: rect.h - FACE_DOWN_SLOT_TOP_PX,
  };
};

/**
 * 손패 맨 왼쪽 카드가 놓일 정확한 중심/높이를 구한다. 카드 치수는 같은 크기인
 * 바닥패 슬롯에서 읽고, 세로 정렬은 스트립의 data-hand-align(start/end)을 따른다.
 * @param playerId - 플레이어 게스트 id
 * @returns 카드 중심/높이, 없으면 null
 */
const handLanding = (playerId: string): Anchor | null => {
  const el = document.querySelector(`[data-anchor="${SHITHEAD_ANCHOR.hand(playerId)}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;

  const slotEl = document.querySelector(
    `[data-anchor="${SHITHEAD_ANCHOR.faceDownSlot(playerId, 0)}"]`,
  );
  const slotRect = slotEl?.getBoundingClientRect();
  if (!slotRect || slotRect.height === 0) {
    return {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      h: rect.height,
    };
  }

  const cardW = slotRect.width;
  const cardH = slotRect.height - FACE_DOWN_SLOT_TOP_PX;
  const alignEnd = el.getAttribute("data-hand-align") === "end";
  return {
    cx: rect.left + cardW / 2,
    cy: alignEnd ? rect.bottom - cardH / 2 : rect.top + cardH / 2,
    h: cardH,
  };
};

export interface FlyingCardProps {
  flight: Flight;
  onDone: (id: number) => void;
}

/**
 * 한 장의 카드가 출발점에서 도착점으로, 각 지점의 카드 크기에 맞춰 커지거나
 * 작아지며 날아가는 애니메이션. 끝나면 스스로 사라진다.
 * @param props - 비행 정보와 완료 콜백
 * @param props.flight
 * @param props.onDone
 * @returns 날아가는 카드 엘리먼트
 */
const FlyingCard = ({ flight, onDone }: FlyingCardProps): JSX.Element => {
  const ref = useRef<HTMLDivElement>(null);
  const { id, from, to, card, delayMs, tiltDeg, hold } = flight;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const baseHeight = el.getBoundingClientRect().height || from.h;
    const scaleFrom = from.h / baseHeight;
    const scaleTo = to.h / baseHeight;
    const dx = to.cx - from.cx;
    const dy = to.cy - from.cy;

    const animation = el.animate(
      [
        {
          transform: `translate(-50%, -50%) scale(${scaleFrom}) rotate(${tiltDeg}deg)`,
          opacity: 0,
        },
        { opacity: 1, offset: 0.2 },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${scaleTo}) rotate(0deg)`,
          opacity: 1,
        },
      ],
      {
        duration: CARD_FLIGHT_DURATION_MS,
        delay: delayMs,
        // 빠르게 튀어나가 부드럽게 안착하는 ease-out.
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "both",
      },
    );
    // hold면 착지 자세를 유지(fill:both)하고 부모가 일괄 제거할 때까지 남는다.
    if (!hold) animation.onfinish = (): void => onDone(id);
    return (): void => animation.cancel();
  }, [id, from.cx, from.cy, from.h, to.cx, to.cy, to.h, delayMs, tiltDeg, hold, onDone]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute"
      style={{ left: from.cx, top: from.cy }}
    >
      <PlayingCard card={card ?? undefined} faceDown={card === null} />
    </div>
  );
};

/**
 * 싯헤드 카드 이동 애니메이션 오버레이. 서버가 보내는 shithead_deal(딜)과
 * shithead_play(카드 냄) 이벤트를 받아, 해당 플레이어 필드/덱에서 더미로
 * 카드가 날아가는 모습을 모두에게 똑같이 보여준다. 상태와 무관한 순수 연출이라
 * 화면 위에 고정 오버레이로 띄운다.
 * @returns 오버레이 엘리먼트
 */
export const ShitheadCardMotions = (): JSX.Element => {
  const [flights, setFlights] = useState<Flight[]>([]);

  useEffect(() => {
    const socket = getSocket();

    /**
     * 한 플레이어가 낸 카드들을 그 손패(없으면 필드)에서 더미로 연속으로 날린다.
     * @param root0 - 이벤트 페이로드
     * @param root0.playerId - 카드를 낸 플레이어
     * @param root0.cards - 더미로 나간 카드들
     */
    const onPlay = ({ playerId, cards }: { playerId: string; cards: Card[] }): void => {
      const from =
        handLanding(playerId) ??
        firstAnchorRect([
          SHITHEAD_ANCHOR.faceDownSlot(playerId, 0),
          SHITHEAD_ANCHOR.field(playerId),
        ]);
      const to = anchorRect(SHITHEAD_ANCHOR.pile);
      if (!from || !to) return;
      const next = cards.map((card, i) => ({
        id: (flightIdSeq += 1),
        from,
        to,
        card,
        delayMs: i * CARD_FLIGHT_STAGGER_MS,
        tiltDeg: 0,
        hold: false,
      }));
      setFlights((prev) => [...prev, ...next]);
    };

    /**
     * 한 플레이어가 더미를 주울 때, 더미에서 그 손패로 카드가 빨려 들어가는 연출.
     * 장수가 많을 수 있어 최대 6장까지만 날린다.
     * @param root0 - 이벤트 페이로드
     * @param root0.playerId - 더미를 주운 플레이어
     * @param root0.count - 주운 카드 수
     */
    const onPickup = ({ playerId, count }: { playerId: string; count: number }): void => {
      const from = anchorRect(SHITHEAD_ANCHOR.pile);
      const to =
        handLanding(playerId) ?? firstAnchorRect([SHITHEAD_ANCHOR.field(playerId)]);
      if (!from || !to) return;
      const shown = Math.min(count, 6);
      const next = Array.from({ length: shown }, (_, i) => ({
        id: (flightIdSeq += 1),
        from,
        to,
        card: null,
        delayMs: i * CARD_FLIGHT_STAGGER_MS,
        tiltDeg: 0,
        hold: false,
      }));
      setFlights((prev) => [...prev, ...next]);
    };

    /**
     * 게임 시작 시 덱에서 각 플레이어에게 카드를 돌리는 연출. 바닥패 3자리 →
     * 손패 순서로, 같은 순서 자리는 모든 플레이어에게 동시에 날아간다. 딜 이벤트가
     * 보드보다 먼저 올 수 있어, 앵커가 아직 없으면 잠깐 뒤 다시 시도한다.
     * @param playerIds - 카드를 받을 플레이어들
     * @param attempt - 재시도 횟수
     */
    const runDeal = (playerIds: string[], attempt: number): void => {
      const from = anchorRect(SHITHEAD_ANCHOR.deck);
      const ready =
        from && playerIds.some((id) => anchorRect(SHITHEAD_ANCHOR.faceDownSlot(id, 0)));
      if (!ready || !from) {
        if (attempt < 12) setTimeout(() => runDeal(playerIds, attempt + 1), 50);
        return;
      }
      // 앵커가 준비돼 실제로 딜이 시작되는 시점을 알린다 — DealingProvider가
      // 이 시점 기준으로 리빌 타이밍을 맞춰야 비행 중에 리빌되지 않는다.
      window.dispatchEvent(new CustomEvent("shithead_deal_start"));

      const next: Flight[] = [];
      // 바닥패 3자리 — 모든 플레이어 동시에, 자리끼리는 순차적으로. 손패는
      // 내/상대 모두 실제 카드가 덱에서 직접 날아드는 연출(useHandDealIn)이라
      // 오버레이로는 날리지 않는다.
      for (let slot = 0; slot < FACE_DOWN_DEAL_SLOTS; slot += 1) {
        for (const playerId of playerIds) {
          const to = slotLanding(playerId, slot);
          if (!to) continue;
          next.push({
            id: (flightIdSeq += 1),
            from,
            to,
            card: null,
            delayMs: slot * CARD_FLIGHT_STAGGER_MS,
            // 목적지 방향으로 살짝 기울여 뿌리는 느낌을 준다.
            tiltDeg: Math.max(-14, Math.min(14, (to.cx - from.cx) * 0.02)),
            // 먼저 착지한 카드도 리빌 순간까지 붙잡아 두어 빈 자리 깜빡임을 막는다.
            hold: true,
          });
        }
      }
      const dealtIds = new Set(next.map((f) => f.id));
      setFlights((prev) => [...prev, ...next]);
      // 실제 카드가 나타나는 시점(딜 윈도우 종료)과 맞춰 붙잡아둔 카드를 한꺼번에 제거.
      setTimeout(() => {
        setFlights((prev) => prev.filter((f) => !dealtIds.has(f.id)));
      }, SHITHEAD_DEAL_TOTAL_MS);
    };

    /**
     * 딜 이벤트 진입점. 같은 딜을 딜 윈도우 안에 중복 처리하지 않도록 막고, 실제
     * 배치는 runDeal에 맡긴다(앵커가 준비될 때까지 재시도).
     * @param root0 - 이벤트 페이로드
     * @param root0.playerIds - 카드를 받을 플레이어들
     */
    const onDeal = ({ playerIds }: { playerIds: string[] }): void => {
      const now = Date.now();
      if (now - lastDealHandledAt < SHITHEAD_DEAL_TOTAL_MS) return;
      lastDealHandledAt = now;
      runDeal(playerIds, 0);
    };

    socket.on("shithead_play", onPlay);
    socket.on("shithead_pickup", onPickup);
    socket.on("shithead_deal", onDeal);
    return (): void => {
      socket.off("shithead_play", onPlay);
      socket.off("shithead_pickup", onPickup);
      socket.off("shithead_deal", onDeal);
    };
  }, []);

  /**
   * 다 날아간 카드를 목록에서 지운다.
   * @param id - 지울 비행 id
   */
  const removeFlight = (id: number): void => {
    setFlights((prev) => prev.filter((f) => f.id !== id));
  };

  if (flights.length === 0) return <></>;

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {flights.map((flight) => (
        <FlyingCard key={flight.id} flight={flight} onDone={removeFlight} />
      ))}
    </div>
  );
};
