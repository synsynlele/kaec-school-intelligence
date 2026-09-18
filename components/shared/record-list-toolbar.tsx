"use client";

import type { ReactNode } from "react";

export type RecordSortOption = {
  value: string;
  label: string;
};

type RecordListToolbarProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  sortValue: string;
  onSortChange: (value: string) => void;
  sortOptions: RecordSortOption[];
  filters?: ReactNode;
  visibleCount?: number;
  totalCount?: number;
  compact?: boolean;
};

export function RecordListToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  sortValue,
  onSortChange,
  sortOptions,
  filters,
  visibleCount,
  totalCount,
  compact = false,
}: RecordListToolbarProps) {
  const showCount =
    typeof visibleCount === "number" && typeof totalCount === "number";

  return (
    <div
      className={`rounded-2xl border border-zinc-200 bg-stone-50/70 ${compact ? "p-3" : "p-4"}`}
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative block min-w-0">
          <span className="sr-only">Search records</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-9 pr-10 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
          />
          {searchValue ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
              aria-label="Clear search"
            >
              Clear
            </button>
          ) : null}
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {filters}
          <label className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-300 bg-white px-3 text-sm">
            <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Sort
            </span>
            <select
              value={sortValue}
              onChange={(event) => onSortChange(event.target.value)}
              className="min-w-0 bg-transparent py-2 text-sm font-medium text-zinc-800 outline-none"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {showCount ? (
        <p className="mt-2 text-xs text-zinc-500">
          Showing {visibleCount} of {totalCount}
        </p>
      ) : null}
    </div>
  );
}
