"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, X } from "lucide-react";
import { DayButton, DayPicker, getDefaultClassNames } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

const ALL_MONTHS = [
  { short: "Jan", full: "January" },
  { short: "Feb", full: "February" },
  { short: "Mar", full: "March" },
  { short: "Apr", full: "April" },
  { short: "May", full: "May" },
  { short: "Jun", full: "June" },
  { short: "Jul", full: "July" },
  { short: "Aug", full: "August" },
  { short: "Sep", full: "September" },
  { short: "Oct", full: "October" },
  { short: "Nov", full: "November" },
  { short: "Dec", full: "December" },
];

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  buttonVariant = "ghost",
  formatters,
  components,
  startMonth,
  endMonth,
  selected,
  onSelect,
  month: controlledMonth,
  onMonthChange: controlledOnMonthChange,
  ...props
}: React.ComponentProps<typeof DayPicker> & {
  buttonVariant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const defaultClassNames = getDefaultClassNames();

  // Internal view state: "days" | "months" | "years"
  const [view, setView] = React.useState<"days" | "months" | "years">("days");

  // Track the month currently displayed in the calendar view
  const initialMonth = (selected instanceof Date ? selected : undefined) || controlledMonth || new Date();
  const [currentDisplayMonth, setCurrentDisplayMonth] = React.useState<Date>(initialMonth);

  // Sync if controlled month changes
  React.useEffect(() => {
    if (controlledMonth) {
      setCurrentDisplayMonth(controlledMonth);
    }
  }, [controlledMonth]);

  // Sync if selected changes and display month is not initialized
  React.useEffect(() => {
    if (selected instanceof Date && !controlledMonth) {
      setCurrentDisplayMonth(selected);
    }
  }, [selected, controlledMonth]);

  const handleMonthChange = (newMonth: Date) => {
    setCurrentDisplayMonth(newMonth);
    controlledOnMonthChange?.(newMonth);
  };

  const displayedYear = currentDisplayMonth.getFullYear();
  const displayedMonthIdx = currentDisplayMonth.getMonth();

  const today = new Date();
  const currentActualYear = today.getFullYear();
  const currentActualMonth = today.getMonth();

  const minYear = startMonth ? startMonth.getFullYear() : 1920;
  const maxYear = endMonth ? endMonth.getFullYear() : currentActualYear + 10;

  // Year list generated descending (e.g. 2026 down to 1920)
  const yearsList: number[] = React.useMemo(() => {
    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      list.push(y);
    }
    return list;
  }, [minYear, maxYear]);

  // Previous / Next month navigation handlers
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const prev = new Date(currentDisplayMonth);
    prev.setMonth(prev.getMonth() - 1);
    handleMonthChange(prev);
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Date(currentDisplayMonth);
    next.setMonth(next.getMonth() + 1);
    handleMonthChange(next);
  };

  // Check if Next Month should be disabled (e.g. if future navigation is restricted by endMonth)
  const isNextMonthDisabled = React.useMemo(() => {
    if (!endMonth) return false;
    const next = new Date(currentDisplayMonth);
    next.setMonth(next.getMonth() + 1);
    return next.getFullYear() > endMonth.getFullYear() ||
      (next.getFullYear() === endMonth.getFullYear() && next.getMonth() > endMonth.getMonth());
  }, [currentDisplayMonth, endMonth]);

  const isPrevMonthDisabled = React.useMemo(() => {
    if (!startMonth) return false;
    const prev = new Date(currentDisplayMonth);
    prev.setMonth(prev.getMonth() - 1);
    return prev.getFullYear() < startMonth.getFullYear() ||
      (prev.getFullYear() === startMonth.getFullYear() && prev.getMonth() < startMonth.getMonth());
  }, [currentDisplayMonth, startMonth]);

  // Auto-scroll selected year into view when Year picker opens
  const selectedYearRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    if (view === "years" && selectedYearRef.current) {
      selectedYearRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [view]);

  return (
    <div
      className={cn(
        "bg-white p-3.5 rounded-2xl select-none font-sans text-slate-800 w-[280px] sm:w-[290px] shadow-xs relative",
        className
      )}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* ========================================================================= */}
      {/* 1. CUSTOM HEADER WITH ACCESSIBLE MONTH & YEAR BUTTONS */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between gap-1 mb-3">
        {/* Previous Month Arrow */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          disabled={isPrevMonthDisabled || view !== "days"}
          className="h-8 w-8 p-0 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
          aria-label="Previous Month"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>

        {/* Center Month & Year Interactive Selectors */}
        <div className="flex items-center gap-1.5">
          {/* Month Selector Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setView(view === "months" ? "days" : "months");
            }}
            className={cn(
              "h-8 px-2.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer select-none",
              view === "months"
                ? "border-blue-600 bg-blue-50 text-blue-700 shadow-xs ring-2 ring-blue-500/20"
                : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-800"
            )}
          >
            <span>{ALL_MONTHS[displayedMonthIdx].short}</span>
            <ChevronDownIcon className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", view === "months" && "rotate-180 text-blue-600")} />
          </button>

          {/* Year Selector Button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setView(view === "years" ? "days" : "years");
            }}
            className={cn(
              "h-8 px-2.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1 cursor-pointer select-none",
              view === "years"
                ? "border-blue-600 bg-blue-50 text-blue-700 shadow-xs ring-2 ring-blue-500/20"
                : "border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-slate-800"
            )}
          >
            <span>{displayedYear}</span>
            <ChevronDownIcon className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", view === "years" && "rotate-180 text-blue-600")} />
          </button>
        </div>

        {/* Next Month Arrow */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          disabled={isNextMonthDisabled || view !== "days"}
          className="h-8 w-8 p-0 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none cursor-pointer transition-colors"
          aria-label="Next Month"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* ========================================================================= */}
      {/* 2. INLINE MONTH SELECTION GRID (Full View with Active Highlights) */}
      {/* ========================================================================= */}
      {view === "months" && (
        <div className="space-y-3 py-1 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-700">Select Month ({displayedYear})</span>
            <button
              type="button"
              onClick={() => setView("days")}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" /> Back
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {ALL_MONTHS.map((m, idx) => {
              const isSelected = idx === displayedMonthIdx;

              // Dynamic check based on CURRENTLY VIEWED YEAR:
              // - If viewedYear < currentActualYear (e.g. 1990, 2000, 2025): ALL months enabled!
              // - If viewedYear === currentActualYear (e.g. 2026): only months > currentActualMonth are disabled.
              // - If viewedYear > currentActualYear: all months disabled.
              let isDisabled = false;
              if (displayedYear > currentActualYear) {
                isDisabled = true;
              } else if (displayedYear === currentActualYear && idx > currentActualMonth) {
                isDisabled = true;
              }

              if (endMonth && displayedYear === endMonth.getFullYear() && idx > endMonth.getMonth()) {
                isDisabled = true;
              }
              if (startMonth && displayedYear === startMonth.getFullYear() && idx < startMonth.getMonth()) {
                isDisabled = true;
              }

              return (
                <button
                  key={m.short}
                  type="button"
                  disabled={isDisabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    const updated = new Date(currentDisplayMonth);
                    updated.setMonth(idx);
                    handleMonthChange(updated);
                    setView("days");
                  }}
                  className={cn(
                    "h-10 rounded-xl text-xs font-bold transition-all duration-150 flex flex-col items-center justify-center cursor-pointer select-none",
                    isSelected
                      ? "bg-blue-600 text-white font-bold shadow-sm shadow-blue-500/25 scale-[1.03]"
                      : isDisabled
                      ? "text-slate-300 opacity-40 cursor-not-allowed bg-slate-50/50"
                      : "text-slate-700 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-transparent"
                  )}
                >
                  <span>{m.short}</span>
                  <span className="text-[9px] font-normal opacity-70 leading-none">{m.full.slice(0, 3)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. INLINE YEAR SELECTION SCROLLABLE GRID */}
      {/* ========================================================================= */}
      {view === "years" && (
        <div className="space-y-3 py-1 animate-in fade-in-50 duration-150">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-700">Select Year (1920 – {maxYear})</span>
            <button
              type="button"
              onClick={() => setView("days")}
              className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" /> Back
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5 max-h-56 overflow-y-auto pr-1 py-1 scrollbar-thin">
            {yearsList.map((y) => {
              const isSelected = y === displayedYear;
              const isDisabled = (endMonth && y > endMonth.getFullYear()) || (startMonth && y < startMonth.getFullYear());

              return (
                <button
                  key={y}
                  ref={isSelected ? selectedYearRef : undefined}
                  type="button"
                  disabled={isDisabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    const updated = new Date(currentDisplayMonth);
                    updated.setFullYear(y);
                    // If moving from historical year to current year, ensure month doesn't exceed current month
                    if (y === currentActualYear && updated.getMonth() > currentActualMonth) {
                      updated.setMonth(currentActualMonth);
                    }
                    handleMonthChange(updated);
                    setView("days");
                  }}
                  className={cn(
                    "h-9 rounded-lg text-xs font-bold transition-all duration-150 flex items-center justify-center cursor-pointer select-none",
                    isSelected
                      ? "bg-blue-600 text-white font-bold shadow-sm shadow-blue-500/25 scale-[1.03]"
                      : isDisabled
                      ? "text-slate-300 opacity-40 cursor-not-allowed bg-slate-50/50"
                      : "text-slate-700 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 border border-transparent"
                  )}
                >
                  {y}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MAIN CALENDAR GRID (Rendered when in 'days' view) */}
      {/* ========================================================================= */}
      {view === "days" && (
        <DayPicker
          showOutsideDays={showOutsideDays}
          month={currentDisplayMonth}
          onMonthChange={handleMonthChange}
          selected={selected}
          onSelect={onSelect}
          startMonth={startMonth}
          endMonth={endMonth}
          className="p-0 select-none font-sans text-slate-800"
          formatters={{
            formatMonthDropdown: (date) => date.toLocaleString("default", { month: "short" }),
            ...formatters,
          }}
          classNames={{
            root: "w-full",
            months: "flex w-full flex-col",
            month: "flex w-full flex-col gap-2",
            nav: "hidden", // We use custom header buttons above
            month_caption: "hidden", // We use custom interactive header above
            table: "w-full border-collapse space-y-1",
            weekdays: "flex justify-between mb-1.5",
            weekday: "text-slate-400 select-none rounded-md w-8 text-center text-[11px] font-semibold uppercase",
            week: "flex w-full justify-between mt-1",
            week_number_header: "w-8 select-none text-[11px]",
            week_number: "text-slate-400 select-none text-[11px]",
            day: "relative aspect-square h-8 w-8 select-none p-0 text-center flex items-center justify-center",
            range_start: "bg-blue-600 text-white rounded-lg",
            range_middle: "bg-blue-50 text-blue-900 rounded-none",
            range_end: "bg-blue-600 text-white rounded-lg",
            today: "font-bold text-blue-600 underline underline-offset-2",
            outside: "text-slate-300 pointer-events-none opacity-40",
            disabled: "text-slate-300 opacity-30 cursor-not-allowed pointer-events-none",
            hidden: "invisible",
            ...classNames,
          }}
          components={{
            Root: ({ className, rootRef, ...props }) => {
              return <div data-slot="calendar" ref={rootRef} className={cn(className)} {...props} />;
            },
            DayButton: CalendarDayButton,
            ...components,
          }}
          {...props}
        />
      )}
    </div>
  );
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const isSelected = modifiers["selected"];
  const isToday = modifiers["today"];
  const isDisabled = modifiers["disabled"];
  const isOutside = modifiers["outside"];

  return (
    <Button
      variant="ghost"
      size="icon"
      disabled={isDisabled}
      className={cn(
        "h-8 w-8 p-0 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer flex items-center justify-center",
        isSelected
          ? "bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs scale-105"
          : isToday
          ? "border border-blue-300 bg-blue-50/70 text-blue-700 font-bold hover:bg-blue-100/60"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
        isOutside && "text-slate-300 opacity-40",
        isDisabled && "text-slate-300 opacity-30 cursor-not-allowed hover:bg-transparent hover:text-slate-300",
        className,
      )}
      {...props}
    />
  );
}

export { Calendar, CalendarDayButton };


