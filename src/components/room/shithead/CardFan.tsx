"use client";

import { Children, useState, type CSSProperties, type JSX, type ReactNode } from "react";
import { useMeasuredWidth } from "@/hooks/useMeasuredWidth";
import { useDealing } from "@/components/room/shithead/DealingContext";
import { useHandDealIn } from "@/hooks/shithead/useHandDealIn";
import { useHandGrowIn } from "@/hooks/shithead/useHandGrowIn";
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
}

/**
 * 카드들을 가로로 겹쳐 배치하는 레이아웃. 부모 폭을 측정해 줄바꿈 없이 그 안에서
 * 최대한 펼쳐 겹친다. 카드에 hover하면 그 카드는 살짝 떠오르고, 오른쪽 카드들만
 * 마지막 카드를 벽에 고정한 채 새로 더 촘촘히 겹쳐 밀려서(computeFanHoverShifts)
 * hover 카드의 3/4가 드러나되 영역을 벗어나지 않는다. 손패/바닥패 선택에서 공용으로 쓴다.
 * @param props - 겹쳐 놓을 카드 엘리먼트들
 * @param props.children - 카드 엘리먼트 목록
 * @param props.dealInOnStart - 딜 시작에 맞춰 덱에서 날아드는 연출 여부
 * @param props.cardKeys - 카드별 고유 키
 * @param props.playerId - 이 손패의 주인
 * @returns 겹침 레이아웃 엘리먼트
 */
export const CardFan = ({
  children,
  dealInOnStart = false,
  cardKeys,
  playerId,
}: CardFanProps): JSX.Element => {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>();
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const dealing = useDealing();
  const flying = useHandDealIn(ref, dealInOnStart);
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
        const lift = index === hoveredIndex ? ` translateY(-${HOVER_LIFT_PX}px)` : "";
        const transform = `translateX(${shifts[index]}px)${lift}`;
        const cardStyle: CSSProperties = {
          marginLeft: index === 0 ? 0 : `${marginPx}px`,
          transform,
        };
        return (
          <div
            key={cardKeys?.[index] ?? index}
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
