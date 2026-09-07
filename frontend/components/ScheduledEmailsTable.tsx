"use client";

import { useState } from "react";
import { useEmailsQuery } from "@/lib/useEmailsQuery";
import { Table, TableColumn } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/StatusBadge";
import { TimeCell } from "@/components/TimeCell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { EmailJob } from "@/lib/types";

const PAGE_SIZE = 20;

export function ScheduledEmailsTable({ searchQuery, onCompose }: { searchQuery: string; onCompose: () => void }) {
  const [page, setPage] = useState(1);
  const { rows, total, loading } = useEmailsQuery({
    statuses: "scheduled,delayed",
    searchQuery,
    page,
    pageSize: PAGE_SIZE,
  });

  const columns: TableColumn<EmailJob>[] = [
    { key: "recipient", header: "Email", render: (r) => r.recipient },
    { key: "subject", header: "Subject", render: (r) => r.subject },
    { key: "scheduled_at", header: "Scheduled time", render: (r) => <TimeCell iso={r.scheduled_at} /> },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  if (!loading && rows.length === 0) {
    return (
      <EmptyState
        icon="📭"
        title="No scheduled emails yet"
        description="Compose a new email to schedule your first send."
        action={<Button onClick={onCompose}>Compose New Email</Button>}
      />
    );
  }

  return (
    <div>
      <Table columns={columns} rows={rows} rowKey={(r) => r.id} loading={loading} />
      {!searchQuery && <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />}
    </div>
  );
}
