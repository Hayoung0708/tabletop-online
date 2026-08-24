import type { JSX } from "react";
import { RULEBOOKS } from "@/constants/rulebook";
import type { PublicRoomState } from "@/server/roomManager";

export interface RulebookProps {
  gameType: PublicRoomState["game"]["type"];
}

/**
 * 게임별 규칙 본문. 사이드바와 모바일 접이식 패널이 같은 내용을 쓴다.
 * @param props - 룰북을 고를 게임 종류
 * @param props.gameType - 현재 방의 게임 종류
 * @returns 규칙 본문 엘리먼트
 */
const RulebookSections = ({ gameType }: RulebookProps): JSX.Element => {
  const { sections } = RULEBOOKS[gameType];

  return (
    <>
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
    </>
  );
};

/**
 * 방 오른쪽에 고정된 게임별 룰북. 왼쪽 참가자 사이드바와 같은 폭(w-72)으로
 * 게임 종류에 맞는 규칙을 소제목별로 보여준다. 폭이 좁은 화면(가로로 눕힌
 * 휴대폰 포함)에서는 자리가 없어 감추고, 대신 본문 아래 접이식
 * 패널(RulebookAccordion)로 보여준다.
 * @param props - 룰북을 고를 게임 종류
 * @param props.gameType - 현재 방의 게임 종류
 * @returns 룰북 사이드바 엘리먼트
 */
export const Rulebook = ({ gameType }: RulebookProps): JSX.Element => {
  const { title } = RULEBOOKS[gameType];

  return (
    <aside className="hidden w-72 shrink-0 flex-col gap-5 overflow-y-auto border-l border-slate-800 px-4 py-4 lg:flex">
      <h2 className="text-xl font-bold text-slate-200">{title}</h2>
      <RulebookSections gameType={gameType} />
    </aside>
  );
};

/**
 * 좁은 화면에서 게임판 아래에 놓는 접이식 룰북. 기본은 접혀 있어 게임판을
 * 가리지 않는다.
 * @param props - 룰북을 고를 게임 종류
 * @param props.gameType - 현재 방의 게임 종류
 * @returns 접이식 룰북 엘리먼트
 */
export const RulebookAccordion = ({ gameType }: RulebookProps): JSX.Element => {
  const { title } = RULEBOOKS[gameType];

  return (
    <details className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 lg:hidden">
      <summary className="cursor-pointer text-base font-bold text-slate-200">
        {title}
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        <RulebookSections gameType={gameType} />
      </div>
    </details>
  );
};
