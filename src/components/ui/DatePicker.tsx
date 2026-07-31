"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

export function DatePicker({ value, onChange }: { value?: string; onChange: (date: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (value) {
      const [year, month] = value.split("-");
      return new Date(parseInt(year), parseInt(month) - 1, 1);
    }
    return new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  function formatDate(isoDate: string): string {
    if (!isoDate) return "";
    const [year, month, day] = isoDate.split("-");
    return `${day}/${month}/${year}`;
  }

  function getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function getFirstDayOfMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  }

  function handleDateClick(day: number) {
    const year = currentMonth.getFullYear();
    const month = String(currentMonth.getMonth() + 1).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    onChange(`${year}-${month}-${dayStr}`);
    setIsOpen(false);
  }

  function handlePrevMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  }

  function handleNextMonth() {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  }

  function handleClear() {
    onChange("");
    setIsOpen(false);
  }

  const daysInMonth = getDaysInMonth(currentMonth);
  const firstDay = getFirstDayOfMonth(currentMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, () => null);

  const monthName = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const [month, year] = monthName.split(" ");

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border-2 border-border bg-secondary px-3 py-1.5 text-sm text-foreground text-left hover:bg-secondary/80 transition-colors flex items-center justify-between focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary"
      >
        <span>{value ? formatDate(value) : "Select date..."}</span>
        {value && (
          <X
            size={14}
            className="hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
          />
        )}
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-2 z-50 bg-card border-2 border-border p-3"
          style={{ boxShadow: "4px 4px 0 var(--color-bg-deep)" }}
        >
          {/* Month Header */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="border-2 border-border px-2 py-1 hover:bg-secondary/80 hover:border-primary transition-colors text-sm font-medium"
            >
              ←
            </button>
            <div className="text-xs font-bold text-center flex-1">
              {month} {year}
            </div>
            <button
              type="button"
              onClick={handleNextMonth}
              className="border-2 border-border px-2 py-1 hover:bg-secondary/80 hover:border-primary transition-colors text-sm font-medium"
            >
              →
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <div key={day} className="text-xs text-center font-bold text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {emptyDays.map((_, i) => (
              <div key={`empty-${i}`} className="w-7 h-7" />
            ))}
            {days.map((day) => {
              const isSelected =
                value &&
                value ===
                  `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDateClick(day)}
                  className={`w-7 h-7 text-xs border-2 hover:bg-primary/30 transition-colors flex items-center justify-center font-medium ${
                    isSelected
                      ? "border-primary bg-primary/40 font-bold text-foreground shadow-inner"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
