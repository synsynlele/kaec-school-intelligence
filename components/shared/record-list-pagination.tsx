"use client";

export type RecordPageSize = 20 | 50 | 100;

type RecordListPaginationProps = {
  page: number;
  pageSize: RecordPageSize;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: RecordPageSize) => void;
  compact?: boolean;
};

export function RecordListPagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  compact = false,
}: RecordListPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const firstItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(safePage * pageSize, totalItems);

  return (
    <div
      className={`flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white ${compact ? "px-3 py-2.5" : "px-4 py-3"} sm:flex-row sm:items-center sm:justify-between`}
    >
      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
        <span>
          Showing <span className="font-semibold text-zinc-800">{firstItem}–{lastItem}</span> of{" "}
          <span className="font-semibold text-zinc-800">{totalItems}</span>
        </span>
        <label className="flex items-center gap-2">
          <span className="font-medium text-zinc-600">Per page</span>
          <select
            value={pageSize}
            onChange={(event) =>
              onPageSizeChange(Number(event.target.value) as RecordPageSize)
            }
            className="min-h-9 rounded-lg border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-800 outline-none focus:border-emerald-700"
            aria-label="Records per page"
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <button
          type="button"
          disabled={safePage <= 1 || totalItems === 0}
          onClick={() => onPageChange(safePage - 1)}
          className="min-h-9 rounded-lg border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="min-w-[88px] text-center text-xs font-medium text-zinc-500">
          Page {totalItems === 0 ? 0 : safePage} of {totalItems === 0 ? 0 : totalPages}
        </span>
        <button
          type="button"
          disabled={safePage >= totalPages || totalItems === 0}
          onClick={() => onPageChange(safePage + 1)}
          className="min-h-9 rounded-lg border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
