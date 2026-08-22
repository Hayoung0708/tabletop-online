"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { getSocket } from "@/lib/socket";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import { setHandGrowSource } from "@/hooks/shithead/handGrowSource";
import { playSoundOnce } from "@/utils/sound";
import { CARD_PLACE_SOUND_SRC, CARD_TAKE_FROM_DECK_SOUND_SRC } from "@/constants/media";
import {
  CARD_FLIGHT_DURATION_MS,
  CARD_FLIGHT_STAGGER_MS,
  FACE_DOWN_DEAL_SLOTS,
  FACE_DOWN_SLOT_TOP_PX,
  PLACE_SOUND_LEAD_MS,
  SHITHEAD_DEAL_TOTAL_MS,
  SHITHEAD_ANCHOR,
} from "@/constants/shithead";
import type { DisplayCard } from "@/components/room/shithead/PlayingCard";

interface Anchor {
  cx: number;
  cy: number;
}

interface Flight {
  id: number;
  from: Anchor;
  to: Anchor;
  /** 앞면으로 보여줄 카드. null이면 뒷면(딜 연출). */
  card: DisplayCard | null;
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
  /**
   * true면 날아가는 도중에 뒷면→앞면으로 반 바퀴(180도) 돈다. 상대방 손패처럼
   * 실제로 어느 카드인지 알 수 없어 특정 카드 위치를 못 찾을 때, 손패 맨 왼쪽
   * 자리에서 뒤집으며 내는 연출에 쓴다.
   */
  flipInFlight?: boolean;
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

/**
 * 상대 손패의 실제 i번째(왼쪽부터) 카드 래퍼의 현재 화면 중심을 구한다.
 * 상대 카드는 전부 뒷면이라 카드 id로 찾을 수 없지만, 여러 장을 한 번에
 * 낼 때 어느 카드들이 나가는지는 정해져 있다 — 항상 왼쪽 카드부터다(새로
 * 들어오는 카드가 왼쪽에 꽂히는 규칙의 반대). 그래서 인덱스로 실제 DOM
 * 위치를 읽으면, 손패 전체를 한 점(handLanding)에서 뭉쳐 날리는 대신 낸
 * 장수만큼 각자 제자리에서 출발하는 것처럼 보인다.
 * @param playerId - 플레이어 게스트 id
 * @param index - 왼쪽부터 몇 번째 카드인지(0부터)
 * @returns 카드 중심, 없으면 null
 */
const handWrapperFrom = (playerId: string, index: number): Anchor | null => {
  const handEl = document.querySelector(
    `[data-anchor="${SHITHEAD_ANCHOR.hand(playerId)}"]`,
  );
  const wrapper = handEl ? Array.from(handEl.children)[index] : undefined;
  if (!wrapper) return null;
  const rect = wrapper.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return null;
  return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
};

export interface FlyingCardProps {
  flight: Flight;
  onFinished: (flight: Flight) => void;
}

// 뒤집기가 비행 시간 중 차지하는 비율. 이동이 강한 감속이라 도착은 앞부분에서
// 대부분 끝나므로, 회전도 앞쪽 구간 안에 마쳐야 "가는 동안 뒤집힌다"고 보인다.
const FLIP_SPIN_PORTION = 0.75;

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
  const spinRef = useRef<HTMLDivElement>(null);
  const { from, to, card, delayMs, tiltDeg, fadeIn, flipInFlight } = flight;
  // 완료 콜백은 부모가 렌더할 때마다 새로 만들어지므로 의존성에 넣으면 안 된다 —
  // 넣으면 방 상태가 갱신될 때마다(카드 보충 등) 이펙트가 다시 돌아 비행이
  // 취소·재시작되고, 같은 카드를 두 번 내는 것처럼 보인다.
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const dx = to.cx - from.cx;
    const dy = to.cy - from.cy;
    const keyframes: Keyframe[] = [
      {
        transform: `translate(-50%, -50%) rotate(${tiltDeg}deg)`,
        opacity: fadeIn ? 0 : 1,
      },
      { opacity: 1, offset: 0.2 },
      {
        transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(0deg)`,
        opacity: 1,
      },
    ];
    // 빠르게 튀어나가 부드럽게 안착하는 ease-out. 착지 자세는 fill:both로
    // 유지되고, 실제 제거 시점은 부모가 정한다.
    const animation = el.animate(keyframes, {
      duration: CARD_FLIGHT_DURATION_MS,
      delay: delayMs,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "both",
    });
    animation.onfinish = (): void => onFinishedRef.current(flight);

    // 뒤집기는 이동과 별개의 엘리먼트·별개의 이징으로 돌린다. 이동과 같은 이징을
    // 쓰면 강한 감속 곡선을 그대로 타서 회전이 초반 100ms 안에 다 끝나버리고,
    // 카드가 더미에 도착한 뒤 순간적으로 앞면이 되는 것처럼 보인다. 여기서는
    // 비행 앞쪽 구간에 걸쳐 일정한 속도로 돌려, 날아가는 동안 뒤집히고 도착할
    // 즈음에는 앞면이 되어 있게 한다.
    const spinEl = spinRef.current;
    if (!flipInFlight || !spinEl) return (): void => animation.cancel();

    const spin = spinEl.animate(
      [{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }],
      {
        duration: CARD_FLIGHT_DURATION_MS * FLIP_SPIN_PORTION,
        delay: delayMs,
        easing: "linear",
        fill: "both",
      },
    );
    return (): void => {
      animation.cancel();
      spin.cancel();
    };
  }, [flight, from.cx, from.cy, to.cx, to.cy, delayMs, tiltDeg, fadeIn, flipInFlight]);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute"
      // perspective는 자식(뒤집히는 래퍼)에 적용되는 속성이라 여기 건다.
      style={{
        left: from.cx,
        top: from.cy,
        perspective: flipInFlight ? "800px" : undefined,
      }}
    >
      {flipInFlight ? (
        <div ref={spinRef} className="relative" style={{ transformStyle: "preserve-3d" }}>
          <div style={{ backfaceVisibility: "hidden" }}>
            <PlayingCard faceDown />
          </div>
          {/* 앞면은 미리 180도 돌려 둔다 — 카드가 180도 뒤집힌 순간 정면으로
              보이고, 좌우가 반전되지도 않는다. */}
          <div
            className="absolute inset-0"
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
          >
            <PlayingCard card={card ?? undefined} />
          </div>
        </div>
      ) : (
        <PlayingCard card={card ?? undefined} faceDown={card === null} />
      )}
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
  // 묶음이 누구의 패였는지 — 착지 이벤트를 그 플레이어에게만 좁혀 알려줄 때 쓴다.
  const groupPlayers = useRef<Map<number, string>>(new Map());

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
    const onPlay = ({
      playerId,
      cards,
    }: {
      playerId: string;
      cards: DisplayCard[];
    }): void => {
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
      const cardFrom = (card: DisplayCard): Anchor | null => {
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
      groupPlayers.current.set(groupId, playerId);
      const next: Flight[] = cards.map((card, i) => {
        // 실제 카드 위치를 못 찾았다는 건(상대 손패는 전부 뒷면이라 카드별
        // id가 없음) 상대 손패에서 낸 카드라는 뜻 — 뒤집으며 날아가는 연출을
        // 넣는다. 여러 장을 한 번에 냈으면 항상 왼쪽부터 나가므로, 손패
        // 한 점(fallbackFrom)에 뭉쳐서 출발시키지 않고 i번째 카드의 실제
        // 자리에서 각자 출발시킨다 — 그래야 "카드가 그 자리에서 이동한다"는
        // 느낌이 나고, 손패 재정렬(useHandGrowIn)과 자연스럽게 이어진다.
        // 얼굴카드/내 손패/뒤집은 바닥패는 항상 실제 위치를 찾으므로 여기
        // 해당하지 않는다.
        const known = cardFrom(card);
        const origin = known ?? handWrapperFrom(playerId, i);
        return {
          id: (flightIdSeq += 1),
          from: origin ?? fallbackFrom,
          to,
          card,
          delayMs: i * CARD_FLIGHT_STAGGER_MS,
          tiltDeg: 0,
          groupId,
          fadeIn: false,
          flipInFlight: !known,
        };
      });
      setFlights((prev) => [...prev, ...next]);
      // 내려놓는 소리는 착지보다 리드 타임만큼 먼저 틀어야 귀에는 착지 순간과
      // 맞게 들린다. 여러 장이면 스태거 간격대로 장수만큼 울린다.
      cards.forEach((_, i) => {
        setTimeout(
          () => playSoundOnce(CARD_PLACE_SOUND_SRC),
          i * CARD_FLIGHT_STAGGER_MS + CARD_FLIGHT_DURATION_MS - PLACE_SOUND_LEAD_MS,
        );
      });
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
     * 뒷카드를 뒤집었는데 낼 수 없어서, 그 카드 한 장만 먼저 손패로 들어갈 때
     * 출발 지점을 그 바닥패 자리로 지정한다. 더미 전체는 뒤이어 onPickup이
     * 처리한다.
     * @param root0 - 이벤트 페이로드
     * @param root0.playerId - 카드를 뒤집은 플레이어
     * @param root0.index - 뒤집었던 바닥패 자리
     */
    const onFaceDownToHand = ({
      playerId,
      index,
    }: {
      playerId: string;
      index: number;
    }): void => {
      setHandGrowSource(
        playerId,
        SHITHEAD_ANCHOR.faceDownSlot(playerId, index),
        PICKUP_SOURCE_TTL_MS,
      );
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
        // 자리마다 카드가 덱에서 출발하는 순간에 소리를 낸다. 같은 자리 카드는
        // 모든 플레이어에게 동시에 날아가므로 playSoundOnce가 한 번으로 묶는다.
        setTimeout(
          () => playSoundOnce(CARD_TAKE_FROM_DECK_SOUND_SRC),
          slot * CARD_FLIGHT_STAGGER_MS,
        );
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
    socket.on("shithead_face_down_to_hand", onFaceDownToHand);
    socket.on("shithead_deal", onDeal);
    // 원카드도 같은 앵커/오버레이를 그대로 쓴다 — 낸 카드가 손에서 더미로
    // 날아가는 연출은 게임과 무관하게 동일하다.
    socket.on("onecard_play", onPlay);
    // 훌라는 버리는 카드가 같은 앵커(버림더미)로 날아간다.
    socket.on("hula_discard", onPlay);
    return (): void => {
      socket.off("shithead_play", onPlay);
      socket.off("shithead_pickup", onPickup);
      socket.off("shithead_face_down_to_hand", onFaceDownToHand);
      socket.off("shithead_deal", onDeal);
      socket.off("onecard_play", onPlay);
      socket.off("hula_discard", onPlay);
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
    const playerId = groupPlayers.current.get(groupId);
    groupPlayers.current.delete(groupId);
    setFlights((prev) => prev.filter((f) => f.groupId !== groupId));
    window.dispatchEvent(new CustomEvent("shithead_play_landed"));
    // 더미 쪽(PileAndDeck)은 누구 카드든 상관없이 반응해도 되지만, 손패
    // 재정렬(OpponentRow)은 다른 플레이어의 착지에 반응하면 안 되므로
    // playerId를 담아 따로 알린다 — 안 그러면 내가 카드를 낸 게 먼저
    // 착지했을 때 상대방의 아직 안 끝난 비행까지 성급하게 풀려버린다.
    if (playerId) {
      window.dispatchEvent(
        new CustomEvent("shithead_hand_landed", { detail: { playerId } }),
      );
    }
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
