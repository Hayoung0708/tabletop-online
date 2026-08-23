"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { Check, Loader2 } from "lucide-react";
import { PlayingCard } from "@/components/room/shithead/PlayingCard";
import { FaceCardSlots } from "@/components/room/shithead/FaceCardSlots";
import { useDealing } from "@/components/room/shithead/DealingContext";
import { useHandDealIn } from "@/hooks/shithead/useHandDealIn";
import { useHandGrowIn } from "@/hooks/shithead/useHandGrowIn";
import { useMeasuredWidth } from "@/hooks/useMeasuredWidth";
import { SHITHEAD_ANCHOR } from "@/constants/shithead";
import { cardsFlightMs, computeHandMargin } from "@/utils/shithead";
import type { PublicShitheadPlayer } from "@/server/shithead/gameLogic";

export interface OpponentRowProps {
  nickname: string;
  player: PublicShitheadPlayer;
  isCurrentTurn: boolean;
  showSelectionStatus: boolean;
}

/**
 * 다른 플레이어 한 명의 카드 상태. 바닥패는 왼쪽에 겹치지 않게, 손패는
 * 그 오른쪽 위쪽에 뒷면으로 겹쳐서 보여준다 (얼굴카드/손패 실제 개수만
 * 공개됨). 얼굴패 선택 단계에는 닉네임 옆에 완료/진행중 아이콘을 보여준다.
 * @param props - 닉네임과 공개된 카드 상태
 * @param props.nickname
 * @param props.player
 * @param props.isCurrentTurn
 * @param props.showSelectionStatus
 * @returns 상대방 카드 영역 엘리먼트
 */
export const OpponentRow = ({
  nickname,
  player,
  isCurrentTurn,
  showSelectionStatus,
}: OpponentRowProps): JSX.Element => {
  const dealing = useDealing();
  const handRef = useRef<HTMLDivElement>(null);
  // 손패 영역의 실제 폭을 재서, 카드가 많아지면 내 손패(CardFan)처럼 겹침을
  // 더 강하게 줘 필드 밖으로 넘치지 않게 한다.
  const [, handWidth] = useMeasuredWidth(handRef);
  // 상대 손패도 내 손패와 똑같이, 딜 시작에 맞춰 덱에서 직접 날아들며 밀린다.
  const flying = useHandDealIn(handRef, true);
  const hidden = dealing && !flying;

  // 한 장 낼 때는 장수를 곧바로 반영한다 — 낸 카드가 즉시 빠지고 나머지가
  // 비행과 동시에 왼쪽으로 밀리는 원래 동작이 자연스럽다.
  //
  // 여러 장(2장 이상)을 한 번에 낼 때만 재정렬을 미룬다: 낸 장수만큼 왼쪽
  // 카드를 숨기되(자리는 유지) 나머지는 제자리에 둔 채, 오버레이 카드들이
  // 더미에 다 착지한 뒤에야 실제 장수로 맞추면서 왼쪽 재정렬이 일어난다.
  // 숨기지 않으면 낸 카드가 손패에 남은 채 복제본이 날아가는 것처럼 보인다.
  //
  // 낸 직후엔 거의 항상 리필이 뒤따라 장수가 다시 늘어난다 — 한 번 얼리면
  // 착지 신호(또는 예비 타임아웃) 전까지 그 사이 변동은 전부 무시하고,
  // 풀리는 순간의 최신 실제 값으로 한 번에 맞춘다.
  const [lastSeenCount, setLastSeenCount] = useState(player.handCount);
  const [lastSelectionDone, setLastSelectionDone] = useState(player.selectionDone);
  const [frozen, setFrozen] = useState<{ count: number; hidden: number } | null>(null);
  // 바닥패를 막 고른 순간의 6장→3장 감소는 카드를 낸 게 아니므로 얼리지 않는다.
  // 전원이 다 골랐는지(allSelected)로 판단하면 안 된다 — 마지막으로 고른
  // 사람은 고르는 그 순간 allSelected가 같이 true가 돼버려서 판단이 뒤집힌다.
  const justSelected = player.selectionDone && !lastSelectionDone;
  if (player.selectionDone !== lastSelectionDone) {
    setLastSelectionDone(player.selectionDone);
  }
  if (player.handCount !== lastSeenCount) {
    const played = lastSeenCount - player.handCount;
    if (frozen === null && played >= 2 && !justSelected) {
      setFrozen({ count: lastSeenCount, hidden: played });
    }
    setLastSeenCount(player.handCount);
  }
  const displayCount = frozen?.count ?? player.handCount;

  useEffect(() => {
    if (frozen === null) return;

    /**
     * 이 플레이어의 카드 묶음이 다 착지하면 얼림을 푼다. shithead_hand_landed는
     * 누가 낸 카드가 착지했는지 playerId로 알려주므로, 다른 플레이어(나 포함)
     * 카드가 먼저 착지해도 이 상대의 손패는 성급하게 풀리지 않는다.
     * @param e - CustomEvent, detail.playerId에 착지한 플레이어가 담김
     */
    const release = (e: Event): void => {
      const { playerId } = (e as CustomEvent<{ playerId: string }>).detail;
      if (playerId === player.userId) setFrozen(null);
    };
    window.addEventListener("shithead_hand_landed", release);
    // 이벤트를 못 받는 경우(연출 스킵 등)를 대비한 예비 해제.
    const fallback = setTimeout(
      () => setFrozen(null),
      cardsFlightMs(frozen.hidden) + 800,
    );
    return (): void => {
      window.removeEventListener("shithead_hand_landed", release);
      clearTimeout(fallback);
    };
  }, [frozen, player.userId]);

  // 상대 손패는 뒷면이라 카드 구분이 없다. 오른쪽 끝을 기준으로 키를 매기면
  // 장수가 늘 때 새 카드가 맨 왼쪽으로 들어오고 나머지가 오른쪽으로 밀린다.
  //
  // 얼려 둔 동안 숨긴 자리에는 별도 키(gone-*)를 준다 — 숨긴 자리가 일반 키를
  // 차지하면, 해제 때 리필로 들어온 카드의 키가 "이미 있던 키"와 겹쳐서
  // useHandGrowIn이 새 카드로 인식하지 못해 덱에서 날아오는 연출이 빠진다.
  const visibleCount = frozen ? frozen.count - frozen.hidden : displayCount;
  const handKeys = [
    ...Array.from({ length: frozen ? frozen.hidden : 0 }, (_, i) => `gone-${i}`),
    ...Array.from({ length: visibleCount }, (_, i) => String(visibleCount - i)),
  ];
  useHandGrowIn(handRef, handKeys, player.userId, !dealing);
  const handMarginPx = computeHandMargin(handKeys.length, handWidth);

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-lg border px-2 pt-2 pb-3 sm:gap-2 sm:px-3 sm:pb-4 ${
        isCurrentTurn ? "border-indigo-500 bg-indigo-950/40" : "border-slate-800"
      }`}
    >
      <div className="flex items-center gap-2 text-base font-semibold text-slate-200 sm:text-lg">
        <span className="truncate">{nickname}</span>
        {player.finishRank && (
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs font-medium text-slate-400">
            {player.finishRank}등
          </span>
        )}
        {showSelectionStatus &&
          (player.selectionDone ? (
            <Check
              className="h-5 w-5 text-emerald-400"
              strokeWidth={3}
              aria-label="얼굴패 선택 완료"
            />
          ) : (
            <Loader2
              className="h-4 w-4 animate-spin text-slate-500"
              aria-label="얼굴패 선택중"
            />
          ))}
      </div>

      <div
        data-anchor={SHITHEAD_ANCHOR.field(player.userId)}
        className="flex w-full items-start gap-6"
      >
        <FaceCardSlots
          faceUp={player.faceUp}
          faceDown={player.faceDown}
          anchorUserId={player.userId}
        />
        {/* z-50: 비행 오버레이(z-40)보다 위 — 손패에서 나가는 카드가 남은
            카드들 아래에 깔린 채 더미로 이동해야 자연스럽다.
            min-w-0 flex-1: 내 손패(CardFan)와 똑같이 남은 공간만큼만 차지하게
            해서 폭을 측정할 수 있게 한다 — 이게 없으면 카드 실제 폭만큼
            계속 늘어나 필드 밖으로 넘친다. */}
        <div
          ref={handRef}
          data-anchor={SHITHEAD_ANCHOR.hand(player.userId)}
          data-hand-align="start"
          className={`relative z-50 flex min-h-[5.625rem] min-w-0 flex-1 sm:min-h-[6.625rem] ${
            hidden ? "invisible" : ""
          }`}
        >
          {handKeys.map((key, index) => (
            <div
              key={key}
              className={`relative ${key.startsWith("gone-") ? "invisible" : ""}`}
              style={{ marginLeft: index === 0 ? 0 : handMarginPx }}
            >
              <PlayingCard faceDown />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
