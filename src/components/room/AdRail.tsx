import type { JSX } from "react";

export interface AdRailProps {
  side: "left" | "right";
}

/**
 * 실제 뷰포트 가장자리에 고정된 광고 자리 (IAB "Wide Skyscraper" 규격).
 * 가운데 콘텐츠 옆이 아니라 화면 끝에 붙어야 진짜 광고처럼 보인다.
 * @param props - 왼쪽/오른쪽 위치
 * @param props.side
 * @returns 광고 자리 엘리먼트
 */
export const AdRail = ({ side }: AdRailProps): JSX.Element => {
  return (
    <div
      className={`pointer-events-none fixed top-1/2 z-0 hidden -translate-y-1/2 xl:block ${
        side === "left" ? "left-6" : "right-6"
      }`}
    >
      <div className="pointer-events-auto flex h-[600px] w-40 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-800 text-xs text-slate-600">
        <span>광고</span>
        <span>160×600</span>
      </div>
    </div>
  );
};
