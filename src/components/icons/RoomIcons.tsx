import type { JSX } from "react";

export interface IconProps {
  className?: string;
}

/**
 * 방장 표시용 왕관 아이콘.
 * @param props - className
 * @param props.className
 * @returns SVG 아이콘
 */
export const CrownIcon = ({ className }: IconProps): JSX.Element => {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M2.5 18.5h19l1-9-5.5 3.2L12 5l-5 7.7-5.5-3.2z" />
    </svg>
  );
};

/**
 * 연결 끊김 표시용 아이콘.
 * @param props - className
 * @param props.className
 * @returns SVG 아이콘
 */
export const DisconnectedIcon = ({ className }: IconProps): JSX.Element => {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <line x1="6.5" y1="6.5" x2="17.5" y2="17.5" />
    </svg>
  );
};

export interface InfoTooltipProps {
  text: string;
}

/**
 * 마우스를 올리면 설명이 뜨는 도움말 아이콘.
 * @param props - 표시할 설명 텍스트
 * @param props.text
 * @returns 아이콘 + 툴팁 엘리먼트
 */
export const InfoTooltip = ({ text }: InfoTooltipProps): JSX.Element => {
  return (
    <span className="group relative inline-flex items-center align-middle">
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5 cursor-help text-slate-500 hover:text-slate-300"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <line x1="12" y1="10.5" x2="12" y2="16" />
        <circle cx="12" cy="7.5" r="0.75" fill="currentColor" stroke="none" />
      </svg>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-20 mb-2 w-72 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm leading-relaxed font-normal whitespace-pre-line text-slate-200 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
};
