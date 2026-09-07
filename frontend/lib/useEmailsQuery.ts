"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import { EmailJob } from "./types";
import { useToast } from "@/components/ui/Toast";

interface Options {
  statuses: string; // comma-separated EmailJobStatus values
  searchQuery: string;
  page: number;
  pageSize: number;
}

// Polling instead of websockets — a documented simplification given the
// assignment's time budget (see README "Assumptions & Trade-offs").
const POLL_INTERVAL_MS = 15000;

export function useEmailsQuery({ statuses, searchQuery, page, pageSize }: Options) {
  const [rows, setRows] = useState<EmailJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const latestRequestId = useRef(0);

  const fetchData = useCallback(
    async (opts?: { silent?: boolean }) => {
      const requestId = ++latestRequestId.current;
      if (!opts?.silent) setLoading(true);
      try {
        const trimmed = searchQuery.trim();
        const result = trimmed
          ? await api.searchEmails(trimmed, statuses || undefined).then((res) => ({ rows: res.results, total: res.results.length }))
          : await api.listEmails({ status: statuses || undefined, page, pageSize }).then((res) => ({ rows: res.results, total: res.total }));

        // A slower, now-stale request (e.g. the user changed the search box
        // again before this one resolved) must not clobber a fresher result.
        if (requestId !== latestRequestId.current) return;
        setRows(result.rows);
        setTotal(result.total);
      } catch {
        if (requestId !== latestRequestId.current) return;
        if (!opts?.silent) showToast("Failed to load emails. Retrying shortly.", "error");
      } finally {
        if (requestId === latestRequestId.current && !opts?.silent) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statuses, searchQuery, page, pageSize]
  );

  // Data fetching on mount/dependency-change is the standard use case for
  // an effect (synchronizing React state with an external system); the
  // loading flag is set synchronously so the UI shows a spinner immediately
  // rather than waiting a tick.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const interval = setInterval(() => fetchData({ silent: true }), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { rows, total, loading, refetch: fetchData };
}
