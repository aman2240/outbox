"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Sender } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { ScheduledEmailsTable } from "@/components/ScheduledEmailsTable";
import { SentEmailsTable } from "@/components/SentEmailsTable";
import { SearchBar } from "@/components/SearchBar";
import { ComposeModal } from "@/components/ComposeModal";
import { useToast } from "@/components/ui/Toast";

type Tab = "scheduled" | "sent";

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("scheduled");
  const [searchQuery, setSearchQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const { showToast } = useToast();

  useEffect(() => {
    api
      .listSenders()
      .then((res) => setSenders(res.senders))
      .catch(() => showToast("Failed to load senders", "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
          <button
            onClick={() => setTab("scheduled")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === "scheduled"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Scheduled Emails
          </button>
          <button
            onClick={() => setTab("sent")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              tab === "sent"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100"
                : "text-slate-500 dark:text-slate-400"
            }`}
          >
            Sent Emails
          </button>
        </div>

        <Button onClick={() => setComposeOpen(true)}>Compose New Email</Button>
      </div>

      <SearchBar onChange={setSearchQuery} />

      {tab === "scheduled" ? (
        <ScheduledEmailsTable
          key={`scheduled-${refreshKey}`}
          searchQuery={searchQuery}
          onCompose={() => setComposeOpen(true)}
        />
      ) : (
        <SentEmailsTable key={`sent-${refreshKey}`} searchQuery={searchQuery} />
      )}

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        senders={senders}
        onScheduled={() => {
          setTab("scheduled");
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}
