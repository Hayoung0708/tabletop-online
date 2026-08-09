"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { getSocket } from "@/lib/socket";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import { setHandGrowSource } from "@/hooks/shithead/handGrowSource";
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
  /**
   * 같은 묶음으로 다뤄야 하는 비행(한 턴에 낸 카드들). 지정하면 묶음의 마지막
   * 한 장이 착지할 때까지 남아 있다가 다 같이 사라진다. 딜은 별도 규칙이라 undefined.
   */
  groupId?: number;
  /** true면 착지 후에도 사라지지 않고 붙잡아 둔다(딜: 리빌 순간 한꺼번에 제거). */
  hold?: boolean;
  /**
   * true면 출발 직후 서서히 나타난다(덱에서 새로 생기는 딜 카드용).
   * 이미 화면에 있던 카드가 이동하는 낼때는 false — 반투명이면 아래 카드가 비친다.
   */
  fadeIn: boolean;
}

let flightIdSeq = 0;
let groupIdSeq = 0;
/** 줍기 직후 이 시간(ms) 안에 늘어난 손패는 더미에서 온 것으로 본다. */
const PICKUP_SOURCE_TTL_MS = 1200;
// 마지막으로 딜을 처리한 시각(ms). 이벤트가 중복 도착하거나 컴포넌트가 재구독돼도
// 딜 애니메이션이 두 번 재생되지 않도록, 딜 윈도우 안에 온 딜 이벤트는 무시한다.
let lastDealHandledAt = 0;

/**
 * data-anchor 엘리먼트의 화면상 중심 좌표를 구한다. 카드는 어디서나 같은
 * 크기라 좌표만 알면 되고, 크기 보정은 하지 않는다.
 * @param anchor - 앵커 이름
 * @returns 중심 좌표, 없으면 null
 */
const anchorRect = (anchor: string): Anchor | null => {
  const el = document.querySelector(`[data-anchor="${anchor}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
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
 * 바닥패 i번째 자리에 실제 뒷카드가 놓이는 정확한 중심을 구한다. 슬롯
 * 컨테이너는 카드보다 위로 10px 크므로(top-2.5) 그만큼 보정해야 리빌 때 실제
 * 카드와 겹쳐 깜빡임이 없다.
 * @param playerId - 플레이어 게스트 id
 * @param index - 바닥패 자리 번호
 * @returns 카드 중심, 없으면 null
 */
const slotLanding = (playerId: string, index: number): Anchor | null => {
  const rect = anchorRect(SHITHEAD_ANCHOR.faceDownSlot(playerId, index));
  if (!rect) return null;
  return { cx: rect.cx, cy: rect.cy + FACE_DOWN_SLOT_TOP_PX / 2 };
};

/**
 * 손패 맨 왼쪽 카드가 놓일 정확한 중심을 구한다. 카드 치수는 같은 크기인
 * 바닥패 슬롯에서 읽고, 세로 정렬은 스트립의 data-hand-align(start/end)을 따른다.
 * @param playerId - 플레이어 게스트 id
 * @returns 카드 중심, 없으면 null
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
    return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
  }

  const cardW = slotRect.width;
  const cardH = slotRect.height - FACE_DOWN_SLOT_TOP_PX;
  const alignEnd = el.getAttribute("data-hand-align") === "end";
  return {
    cx: rect.left + cardW / 2,
    cy: alignEnd ? rect.bottom - cardH / 2 : rect.top + cardH / 2,
  };
};

export interface FlyingCardProps {
  flight: Flight;
  onFinished: (flight: Flight) => void;
}

/**
 * 한 장의 카드가 출발점에서 도착점으로 날아가는 애니메이션. 카드 크기는
 * 어디서나 같으므로 위치만 옮긴다. 착지하면 부모에게 알린다.
 * @param props - 비행 정보와 완료 콜백
 * @param props.flight
 * @param props.onFinished
 * @returns 날아가는 카드 엘리먼트
 */
const FlyingCard = ({ flight, onFinished }: FlyingCardProps): JSX.Element => {
  const ref = useRef<HTMLDivElement>(null);
  const { from, to, card, delayMs, tiltDeg, fadeIn } = flight;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dx = to.cx - from.cx;
    const dy = to.cy - from.cy;

    const animation = el.animate(
      [
        {
          transform: `translate(-50%, -50%) rotate(${tiltDeg}deg)`,
          opacity: fadeIn ? 0 : 1,
        },
        { opacity: 1, offset: 0.2 },
        {
          transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(0deg)`,
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
    // 착지 자세는 fill:both로 유지되고, 실제 제거 시점은 부모가 정한다.
    animation.onfinish = (): void => onFinished(flight);
    return (): void => animation.cancel();
  }, [flight, from.cx, from.cy, to.cx, to.cy, delayMs, tiltDeg, fadeIn, onFinished]);

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
  // 묶음별 총 장수와 지금까지 착지한 장수 — 마지막 한 장이 착지하는 순간을 안다.
  const groupSizes = useRef<Map<number, number>>(new Map());
  const groupLanded = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    const socket = getSocket();

    /**
     * 한 플레이어가 낸 카드들을 그 카드가 놓여 있던 자리에서 더미로 연속으로
     * 날린다. 낸 카드는 착지 후에도 더미 top이 실제로 갱신될 때까지 남겨 두어,
     * 먼저 착지한 카드가 사라지며 이전 top이 비쳐 보이는 걸 막는다. 보충 카드는
     * 실제 손패 카드가 직접 날아오므로(useHandGrowIn) 여기서 다루지 않는다.
     * @param root0 - 이벤트 페이로드
     * @param root0.playerId - 카드를 낸 플레이어
     * @param root0.cards - 더미로 나간 카드들
     */
    const onPlay = ({ playerId, cards }: { playerId: string; cards: Card[] }): void => {
      const fallbackFrom =
        handLanding(playerId) ??
        firstAnchorRect([
          SHITHEAD_ANCHOR.faceDownSlot(playerId, 0),
          SHITHEAD_ANCHOR.field(playerId),
        ]);
      const to = anchorRect(SHITHEAD_ANCHOR.pile);
      if (!fallbackFrom || !to) return;

      // 출발점은 실제로 그 카드가 놓여 있던 자리 — 필드(손패/얼굴패) 안에서
      // 카드 id로 찾는다. 이벤트가 상태 갱신보다 먼저 오므로 아직 옛 DOM이 남아있다.
      const fieldEl = document.querySelector(
        `[data-anchor="${SHITHEAD_ANCHOR.field(playerId)}"]`,
      );
      /**
       * 낸 카드가 놓여 있던 화면 위치를 찾는다.
       * @param card - 찾을 카드
       * @returns 카드 중심, 못 찾으면 null
       */
      const cardFrom = (card: Card): Anchor | null => {
        const el = fieldEl?.querySelector(`[data-card-id="${card.id}"]`);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;
        return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
      };

      // 한 번에 낸 카드들을 한 묶음으로 묶어, 마지막 한 장이 실제로 착지한
      // 순간에 다 같이 치우고 더미를 갱신한다(타이머로 재면 시계가 어긋나
      // 카드가 잠깐 사라졌다 나타나며 밑 카드가 비친다).
      const groupId = (groupIdSeq += 1);
      groupSizes.current.set(groupId, cards.length);
      const next: Flight[] = cards.map((card, i) => ({
        id: (flightIdSeq += 1),
        from: cardFrom(card) ?? fallbackFrom,
        to,
        card,
        delayMs: i * CARD_FLIGHT_STAGGER_MS,
        tiltDeg: 0,
        groupId,
        fadeIn: false,
      }));
      setFlights((prev) => [...prev, ...next]);
    };

    /**
     * 한 플레이어가 더미를 주울 때는 실제로 손패에 들어온 카드들이 더미에서
     * 직접 날아온다(useHandGrowIn). 여기서는 그 출발 지점만 더미로 지정한다.
     * @param root0 - 이벤트 페이로드
     * @param root0.playerId - 더미를 주운 플레이어
     */
    const onPickup = ({ playerId }: { playerId: string }): void => {
      setHandGrowSource(playerId, SHITHEAD_ANCHOR.pile, PICKUP_SOURCE_TTL_MS);
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
            fadeIn: true,
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
   * 착지한 카드를 정리한다. 묶음(한 턴에 낸 카드들)은 마지막 한 장이 착지해야
   * 다 같이 사라지고, 그 순간 더미가 새 top으로 바뀐다 — 비행이 먼저 지워져
   * 밑 카드가 비치거나, 늦게 지워져 두 번 재생된 것처럼 보이는 걸 막는다.
   * @param finished - 착지한 비행
   */
  const handleFinished = (finished: Flight): void => {
    // 딜 카드는 리빌 시점까지 붙잡아 둔다 — runDeal의 타이머가 치운다.
    if (finished.hold) return;
    const { groupId } = finished;
    if (groupId === undefined) {
      setFlights((prev) => prev.filter((f) => f.id !== finished.id));
      return;
    }

    const landed = (groupLanded.current.get(groupId) ?? 0) + 1;
    groupLanded.current.set(groupId, landed);
    if (landed < (groupSizes.current.get(groupId) ?? 0)) return;

    groupLanded.current.delete(groupId);
    groupSizes.current.delete(groupId);
    setFlights((prev) => prev.filter((f) => f.groupId !== groupId));
    window.dispatchEvent(new CustomEvent("shithead_play_landed"));
  };

  if (flights.length === 0) return <></>;

  return (
    <div className="pointer-events-none fixed inset-0 z-40">
      {flights.map((flight) => (
        <FlyingCard key={flight.id} flight={flight} onFinished={handleFinished} />
      ))}
    </div>
  );
};
