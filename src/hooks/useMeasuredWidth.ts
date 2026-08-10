"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * 엘리먼트의 실제 렌더 폭(px)을 측정해서 반환한다. 반응형으로 부모 크기가
 * 바뀌면 ResizeObserver가 다시 측정한다. 측정 전 초깃값은 0이다.
 * @param externalRef - 이미 다른 용도로 쓰고 있는 ref가 있으면 새로 만들지 않고 그걸 그대로 측정한다.
 * @returns [측정 대상에 붙일 ref, 현재 폭(px)]
 */
export const useMeasuredWidth = <T extends HTMLElement>(
  externalRef?: RefObject<T | null>,
): [RefObject<T | null>, number] => {
  const ownRef = useRef<T>(null);
  const ref = externalRef ?? ownRef;
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const [entry] = entries;
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return (): void => observer.disconnect();
  }, []);

  return [ref, width];
};
