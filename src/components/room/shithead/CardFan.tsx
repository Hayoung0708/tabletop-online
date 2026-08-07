"use client";

import { Children, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import { useMeasuredWidth } from "@/hooks/useMeasuredWidth";
import { computeFanHoverShifts, computeHandMargin } from "@/utils/shithead";

/** hover한 카드가 살짝 떠오르는 높이(px). */
const HOVER_LIFT_PX = 8;

export interface CardFanProps {
  children: ReactNode;
}

/**
 * 카드들을 가로로 겹쳐 배치하는 레이아웃. 부모 폭을 측정해 줄바꿈 없이 그 안에서
 * 최대한 펼쳐 겹친다. 카드에 hover하면 그 카드는 살짝 떠오르고, 오른쪽 카드들만
 * 마지막 카드를 벽에 고정한 채 새로 더 촘촘히 겹쳐 밀려서(computeFanHoverShifts)
 * hover 카드의 3/4가 드러나되 영역을 벗어나지 않는다. 손패/바닥패 선택에서 공용으로 쓴다.
 * @param props - 겹쳐 놓을 카드 엘리먼트들
 * @param props.children - 카드 엘리먼트 목록
 * @returns 겹침 레이아웃 엘리먼트
 */
export const CardFan = ({ children }: CardFanProps): JSX.Element => {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const cards = Children.toArray(children);
  const marginPx = computeHandMargin(cards.length, width);
  const shifts = computeFanHoverShifts(cards.length, width, hoveredIndex);

  return (
    <div
      ref={ref}
      className="flex min-w-0 flex-1 items-end"
      onMouseLeave={(): void => setHoveredIndex(null)}
    >
      {cards.map((card, index) => {
        const lift = index === hoveredIndex ? ` translateY(-${HOVER_LIFT_PX}px)` : "";
        const transform = `translateX(${shifts[index]}px)${lift}`;
        const cardStyle: CSSProperties = {
          marginLeft: index === 0 ? 0 : `${marginPx}px`,
          transform,
        };
        return (
          <div
            key={index}
            className="relative transition-transform duration-150"
            style={cardStyle}
            onMouseEnter={(): void => setHoveredIndex(index)}
          >
            {card}
          </div>
        );
      })}
    </div>
  );
};
