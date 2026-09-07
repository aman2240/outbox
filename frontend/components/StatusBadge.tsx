import { EmailJobStatus } from "@/lib/types";

const STYLES: Record<EmailJobStatus, string> = {
  scheduled: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  delayed: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  processing: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  sent: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
};

const LABELS: Record<EmailJobStatus, string> = {
  scheduled: "Scheduled",
  delayed: "Delayed",
  processing: "Processing",
  sent: "Sent",
  failed: "Failed",
};

export function StatusBadge({ status }: { status: EmailJobStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
