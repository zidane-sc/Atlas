"use client";

import { useEffect, useRef, useState, useMemo } from "react";

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
}

export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className = "",
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const { visibleStart, visibleEnd, offsetY } = useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const end = Math.min(items.length, start + visibleCount + overscan * 2);

    return {
      visibleStart: start,
      visibleEnd: end,
      offsetY: start * itemHeight,
    };
  }, [scrollTop, containerHeight, itemHeight, items.length, overscan]);

  const visibleItems = items.slice(visibleStart, visibleEnd);
  const totalHeight = items.length * itemHeight;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
          }}
        >
          {visibleItems.map((item, i) => (
            <div key={visibleStart + i} style={{ height: itemHeight }}>
              {renderItem(item, visibleStart + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
