import type { JSX } from "react";
import { RULEBOOKS } from "@/constants/rulebook";
import type { PublicRoomState } from "@/server/roomManager";

export interface RulebookProps {
  gameType: PublicRoomState["game"]["type"];
}

/**
 * 방 오른쪽에 고정된 게임별 룰북. 왼쪽 참가자 사이드바와 같은 폭(w-72)으로
 * 게임 종류에 맞는 규칙을 소제목별로 보여준다.
 * @param props - 룰북을 고를 게임 종류
 * @param props.gameType - 현재 방의 게임 종류
 * @returns 룰북 사이드바 엘리먼트
 */
export const Rulebook = ({ gameType }: RulebookProps): JSX.Element => {
  const { title, sections } = RULEBOOKS[gameType];

  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-5 overflow-y-auto border-l border-slate-800 px-4 py-4 sm:flex">
      <h2 className="text-xl font-bold text-slate-200">{title}</h2>
      {sections.map((section) => (
        <div key={section.heading} className="flex flex-col gap-2">
          <h3 className="text-lg font-medium text-indigo-300">{section.heading}</h3>
          <ul className="flex flex-col gap-1.5">
            {section.items.map((item) => (
              <li key={item} className="text-base leading-relaxed text-slate-300">
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </aside>
  );
};
