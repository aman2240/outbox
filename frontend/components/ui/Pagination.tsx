interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm text-slate-500 dark:text-slate-400">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-slate-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600"
        >
          Prev
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-slate-300 px-3 py-1 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600"
        >
          Next
        </button>
      </div>
    </div>
  );
}
