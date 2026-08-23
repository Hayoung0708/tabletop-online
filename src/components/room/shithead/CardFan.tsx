"use client";

import { Children, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import { useMeasuredWidth } from "@/hooks/useMeasuredWidth";
import { useDealing } from "@/components/room/shithead/DealingContext";
import { useHandDealIn } from "@/hooks/shithead/useHandDealIn";
import { useHandDealInOnMount } from "@/hooks/shithead/useHandDealInOnMount";
import { useHandGrowIn } from "@/hooks/shithead/useHandGrowIn";
import { useHandDragReorder } from "@/hooks/shithead/useHandDragReorder";
import { computeFanHoverShifts, computeHandMargin } from "@/utils/shithead";

/** hover한 카드가 살짝 떠오르는 높이(px). */
const HOVER_LIFT_PX = 8;

export interface CardFanProps {
  children: ReactNode;
  /**
   * true면 딜 시작 신호(shithead_deal_start)에 맞춰 카드가 덱에서 손패 맨 왼쪽
   * 자리로 한 장씩 날아들고, 먼저 온 카드는 도착할 때마다 오른쪽으로 밀려난다.
   * 최종 맨 오른쪽 카드가 첫 번째로 도착한 카드다.
   */
  dealInOnStart?: boolean;
  /** 카드별 고유 키. 주면 새로 들어온 카드가 덱/더미에서 날아드는 연출을 한다. */
  cardKeys?: string[];
  /** 이 손패의 주인 — 새 카드가 어디서 오는지(덱/더미) 찾는 데 쓴다. */
  playerId?: string;
  /**
   * true면 마운트 직후 카드들이 덱에서 날아드는 딜 연출을 한다. 딜 소켓
   * 이벤트가 따로 없는 게임(원카드)이 게임 시작 직후에만 켠다.
   */
  dealInOnMount?: boolean;
  /**
   * 주면 손패 카드를 좌우로 끌어 순서를 바꿀 수 있다. 새 순서(카드 키 목록)를
   * 돌려주며, 화면 순서는 받는 쪽이 관리한다.
   */
  onReorder?: (keys: string[]) => void;
}

/**
 * 카드들을 가로로 겹쳐 배치하는 레이아웃. 부모 폭을 측정해 줄바꿈 없이 그 안에서
 * 최대한 펼쳐 겹친다. 카드에 hover하면 그 카드는 살짝 떠오르고, 오른쪽 카드들만
 * 마지막 카드를 벽에 고정한 채 새로 더 촘촘히 겹쳐 밀려서(computeFanHoverShifts)
 * hover 카드의 3/4가 드러나되 영역을 벗어나지 않는다. 손패/얼굴패 선택에서 공용으로 쓴다.
 * @param props - 겹쳐 놓을 카드 엘리먼트들
 * @param props.children - 카드 엘리먼트 목록
 * @param props.dealInOnStart - 딜 시작에 맞춰 덱에서 날아드는 연출 여부
 * @param props.cardKeys - 카드별 고유 키
 * @param props.playerId - 이 손패의 주인
 * @param props.dealInOnMount - 마운트 직후 덱에서 날아드는 딜 연출 여부
 * @param props.onReorder - 드래그로 순서를 바꿨을 때 새 순서를 받을 콜백
 * @returns 겹침 레이아웃 엘리먼트
 */
export const CardFan = ({
  children,
  dealInOnStart = false,
  cardKeys,
  playerId,
  dealInOnMount = false,
  onReorder,
}: CardFanProps): JSX.Element => {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const drag = useHandDragReorder(ref, cardKeys ?? [], onReorder);
  const dealing = useDealing();
  const flying = useHandDealIn(ref, dealInOnStart);
  useHandDealInOnMount(ref, dealInOnMount);
  const cards = Children.toArray(children);
  const marginPx = computeHandMargin(cards.length, width);
  const shifts = computeFanHoverShifts(cards.length, width, hoveredIndex);

  // 새로 들어온 카드는 실제 카드 엘리먼트가 직접 날아온다 — 오버레이 사본을
  // 쓰지 않으므로 같은 카드가 두 장으로 보일 일이 없다.
  useHandGrowIn(ref, cardKeys ?? [], playerId ?? "", Boolean(cardKeys) && !dealing);

  // 딜 연출 대기 중에는 카드를 감춰 둔다(레이아웃은 유지). 애니메이션이 fill
  // backwards로 시작 상태(덱 위치·투명)를 잡은 뒤에 보이게 전환된다.
  const hidden = dealInOnStart && dealing && !flying;

  return (
    <div
      ref={ref}
      className={`flex min-w-0 flex-1 items-end ${hidden ? "invisible" : ""}`}
      onMouseLeave={(): void => setHoveredIndex(null)}
    >
      {cards.map((card, index) => {
        const key = cardKeys?.[index] ?? String(index);
        const isDragging = drag.draggingKey === key;
        // 끌고 있는 카드는 가로로만 따라온다 — 세로로 뜨면 손패 줄이 흔들린다.
        const lift =
          index === hoveredIndex && !isDragging ? ` translateY(-${HOVER_LIFT_PX}px)` : "";
        const shift = isDragging ? shifts[index] + drag.offsetX : shifts[index];
        const cardStyle: CSSProperties = {
          marginLeft: index === 0 ? 0 : `${marginPx}px`,
          transform: `translateX(${shift}px)${lift}`,
          // 끄는 동안에는 커서를 그대로 따라와야 해서 전이를 끈다.
          transition: isDragging ? "none" : undefined,
          zIndex: isDragging ? 50 : undefined,
          touchAction: onReorder ? "none" : undefined,
        };
        return (
          <div
            key={key}
            // 순서를 바꿀 수 있는 손패는 내 차례가 아니어도 집을 수 있다는 걸
            // 커서로 알린다.
            className={`relative transition-transform duration-150 ${
              onReorder ? "cursor-pointer" : ""
            }`}
            style={cardStyle}
            onMouseEnter={(): void => setHoveredIndex(index)}
            {...(onReorder ? drag.handlers(key) : {})}
          >
            {card}
          </div>
        );
      })}
    </div>
  );
};
