"use client";

import { useState } from "react";

export interface Celebration {
  id: number;
}

export interface UseYahtzeeCelebrationsResult {
  celebrations: Celebration[];
  addCelebration: () => void;
  removeCelebration: (id: number) => void;
}

let celebrationIdSeq = 0;

/**
 * 화면 전체에 뜨는 야찌 컨페티 연출들의 목록을 관리한다. 동시에 여러 개가
 * 겹쳐 뜰 수 있어 배열로 관리하고, 각 연출은 끝나면 스스로 제거를 요청한다.
 * @returns 활성 연출 목록과 추가/제거 함수
 */
export const useYahtzeeCelebrations = (): UseYahtzeeCelebrationsResult => {
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);

  /** 새 컨페티 연출을 활성 목록에 추가한다. */
  const addCelebration = (): void => {
    celebrationIdSeq += 1;
    setCelebrations((prev) => [...prev, { id: celebrationIdSeq }]);
  };

  /**
   * 재생이 끝난 컨페티 연출을 목록에서 지운다.
   * @param id
   */
  const removeCelebration = (id: number): void => {
    setCelebrations((prev) => prev.filter((c) => c.id !== id));
  };

  return { celebrations, addCelebration, removeCelebration };
};
