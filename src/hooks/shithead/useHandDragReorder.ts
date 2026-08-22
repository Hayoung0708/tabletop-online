"use client";

import {
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
} from "react";

/** 이만큼 끌기 전에는 클릭(선택)으로 본다 — 손이 살짝 떨려도 카드가 안 움직인다. */
const DRAG_THRESHOLD_PX = 6;

interface DragSession {
  key: string;
  pointerId: number;
  startX: number;
  /** 드래그 시작 시점의 카드 중심 x좌표들 — 놓을 자리를 이 좌표로 판단한다. */
  centers: number[];
  /** 손패 영역을 벗어나지 않도록 가로 이동을 가두는 범위. */
  minX: number;
  maxX: number;
  /** 문턱을 넘어 실제로 끌기 시작했는지. */
  active: boolean;
}

export interface HandDragHandlers {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
  onClickCapture: (event: MouseEvent<HTMLElement>) => void;
}

export interface HandDragState {
  /** 지금 끌고 있는 카드의 키. 없으면 null. */
  draggingKey: string | null;
  /** 끌고 있는 카드에 적용할 가로 이동량(px). */
  offsetX: number;
  /** 카드 래퍼에 그대로 붙이는 포인터 핸들러. */
  handlers: (key: string) => HandDragHandlers;
}

/**
 * 손패 카드를 좌우로 끌어 순서를 바꾸는 동작. 세로로는 움직이지 않고 손패
 * 영역 밖으로도 나가지 않으며, 놓는 순간 커서 위치에서 가장 가까운 자리로
 * 들어간다. 진행 상태는 ref에 두고 화면 갱신에만 state를 쓴다 — 핸들러가
 * 낡은 값을 보고 드롭을 놓치는 걸 막기 위함이다.
 * @param containerRef - 카드 래퍼들이 직계 자식인 컨테이너 ref
 * @param cardKeys - 지금 화면 순서대로의 카드 키
 * @param onReorder - 새 순서를 알려줄 콜백. 없으면 드래그를 하지 않는다
 * @returns 끌고 있는 카드 정보와 포인터 핸들러
 */
export const useHandDragReorder = (
  containerRef: RefObject<HTMLElement | null>,
  cardKeys: string[],
  onReorder?: (keys: string[]) => void,
): HandDragState => {
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const session = useRef<DragSession | null>(null);
  // 끌고 난 직후의 클릭은 삼킨다 — 자리를 옮겼을 뿐인데 선택까지 토글되면 안 된다.
  const justDragged = useRef(false);

  /** 진행 중인 드래그를 정리한다. */
  const endSession = (): void => {
    session.current = null;
    setDraggingKey(null);
    setOffsetX(0);
  };

  /**
   * 한 카드에 붙일 포인터 핸들러를 만든다.
   * @param key - 이 카드의 키
   * @returns 포인터 핸들러 모음
   */
  const handlers = (key: string): HandDragHandlers => ({
    onPointerDown: (event): void => {
      if (!onReorder) return;
      const container = containerRef.current;
      if (!container) return;
      // 앞선 드래그가 클릭 없이 끝났을 수 있다 — 새로 누를 때 삼킴 표시를 푼다.
      justDragged.current = false;

      const children = Array.from(container.children) as HTMLElement[];
      const containerRect = container.getBoundingClientRect();
      const cardRect = event.currentTarget.getBoundingClientRect();
      session.current = {
        key,
        pointerId: event.pointerId,
        startX: event.clientX,
        centers: children.map((child) => {
          const rect = child.getBoundingClientRect();
          return rect.left + rect.width / 2;
        }),
        minX: containerRect.left - cardRect.left,
        maxX: containerRect.right - cardRect.right,
        active: false,
      };
    },
    onPointerMove: (event): void => {
      const drag = session.current;
      if (!drag || drag.key !== key) return;

      const dx = event.clientX - drag.startX;
      if (!drag.active) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        // 문턱을 넘은 뒤에야 포인터를 잡는다 — 누르자마자 잡으면 카드 클릭
        // 이벤트가 래퍼로 넘어가 선택이 아예 안 된다.
        drag.active = true;
        event.currentTarget.setPointerCapture(drag.pointerId);
        setDraggingKey(key);
      }
      setOffsetX(Math.min(Math.max(dx, drag.minX), drag.maxX));
    },
    onPointerUp: (event): void => {
      const drag = session.current;
      if (!drag || drag.key !== key) return;
      const wasActive = drag.active;
      const dropX = event.clientX;
      endSession();
      if (!wasActive || !onReorder) return;

      justDragged.current = true;
      const from = cardKeys.indexOf(key);
      // 커서보다 왼쪽에 있던 카드 수가 곧 들어갈 자리다. 자기 자신은 이미
      // 왼쪽에 세었을 수 있으니 그만큼 빼 준다.
      const leftCount = drag.centers.filter((center) => center < dropX).length;
      const to = Math.min(
        Math.max(leftCount > from ? leftCount - 1 : leftCount, 0),
        cardKeys.length - 1,
      );
      if (from < 0 || from === to) return;

      const next = [...cardKeys];
      next.splice(from, 1);
      next.splice(to, 0, key);
      onReorder(next);
    },
    onPointerCancel: (): void => endSession(),
    onClickCapture: (event): void => {
      if (!justDragged.current) return;
      justDragged.current = false;
      event.stopPropagation();
    },
  });

  return { draggingKey, offsetX, handlers };
};
