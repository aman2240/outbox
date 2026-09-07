import { formatRelativeAndAbsolute } from "@/lib/format";

export function TimeCell({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-slate-400">—</span>;
  const { relative, absolute } = formatRelativeAndAbsolute(iso);
  return (
    <span title={absolute} className="whitespace-nowrap">
      {relative}
    </span>
  );
}
