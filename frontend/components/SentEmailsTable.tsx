"use client";

import { useState } from "react";
import { useEmailsQuery } from "@/lib/useEmailsQuery";
import { Table, TableColumn } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { TimeCell } from "@/components/TimeCell";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmailJob } from "@/lib/types";

const PAGE_SIZE = 20;

// Sent and failed emails share this one tab (both are "done processing",
// distinguished by badge color) rather than a separate filter toggle —
// simpler UI for the assignment's scope; documented in the README.
export function SentEmailsTable({ searchQuery }: { searchQuery: string }) {
  const [page, setPage] = useState(1);
  const { rows, total, loading } = useEmailsQuery({
    statuses: "sent,failed",
    searchQuery,
    page,
    pageSize: PAGE_SIZE,
  });

  const columns: TableColumn<EmailJob>[] = [
    { key: "recipient", header: "Email", render: (r) => r.recipient },
    { key: "subject", header: "Subject", render: (r) => r.subject },
    { key: "sent_at", header: "Sent time", render: (r) => <TimeCell iso={r.sent_at} /> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "preview",
      header: "",
      render: (r) =>
        r.preview_url ? (
          <a
            href={r.preview_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
          >
            View
          </a>
        ) : r.status === "failed" && r.error_message ? (
          <span className="text-xs text-red-500" title={r.error_message}>
            Error
          </span>
        ) : null,
    },
  ];

  if (!loading && rows.length === 0) {
    return <EmptyState icon="📬" title="No sent emails yet" description="Sent and failed emails will show up here." />;
  }

  return (
    <div>
      <Table columns={columns} rows={rows} rowKey={(r) => r.id} loading={loading} />
      {!searchQuery && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}
    </div>
  );
}
