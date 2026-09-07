"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";

export function SlackConnectButton() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { showToast } = useToast();

  const refresh = () => {
    api
      .getSlackStatus()
      .then((res) => {
        setConnected(res.connected);
        setTeamName(res.teamName);
      })
      .catch(() => setConnected(false));
  };

  useEffect(() => {
    refresh();

    const params = new URLSearchParams(window.location.search);
    const slackParam = params.get("slack");
    if (slackParam === "connected") {
      showToast("Slack connected successfully.", "success");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (slackParam === "error") {
      showToast("Slack connection failed. Please try again.", "error");
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await api.disconnectSlack();
      setConnected(false);
      showToast("Slack disconnected.", "success");
    } catch {
      showToast("Failed to disconnect Slack.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (connected === null) return null;

  if (connected) {
    return (
      <Button variant="secondary" onClick={handleDisconnect} loading={busy} className="whitespace-nowrap">
        Slack Connected{teamName ? ` (${teamName})` : ""} ✓ — Disconnect
      </Button>
    );
  }

  return (
    <a href={api.connectSlackUrl()}>
      <Button variant="secondary" className="whitespace-nowrap">
        Connect Slack
      </Button>
    </a>
  );
}
