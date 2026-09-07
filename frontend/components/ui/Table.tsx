import { ReactNode } from "react";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface TableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  skeletonRows?: number;
  onRowClick?: (row: T) => void;
}

export function Table<T>({ columns, rows, rowKey, loading, skeletonRows = 5, onRowClick }: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 font-medium">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {loading
            ? Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 w-full max-w-[160px] animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60" : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 text-slate-700 dark:text-slate-200 ${col.className ?? ""}`}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
