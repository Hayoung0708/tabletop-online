"use client";

const PIP_POSITIONS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Die({
  value,
  held,
  rolling,
  onClick,
  disabled,
}: {
  value: number;
  held?: boolean;
  rolling?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const pips = PIP_POSITIONS[value] ?? [];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={held}
      className={`die grid h-14 w-14 shrink-0 grid-cols-3 grid-rows-3 gap-1 rounded-lg border-2 p-2 shadow transition-all duration-150 sm:h-16 sm:w-16 sm:p-2.5 ${
        held
          ? "-translate-y-1 border-indigo-400 bg-indigo-50 shadow-indigo-500/50"
          : "border-slate-300 bg-white"
      } ${rolling ? "opacity-80" : ""} ${
        disabled
          ? "cursor-not-allowed"
          : "cursor-pointer hover:-translate-y-0.5"
      }`}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <span key={i} className="flex items-center justify-center">
          {pips.includes(i) && (
            <span
              className={`h-2.5 w-2.5 rounded-full sm:h-3 sm:w-3 ${
                held ? "bg-indigo-600" : "bg-slate-800"
              }`}
            />
          )}
        </span>
      ))}
    </button>
  );
}
