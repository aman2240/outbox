"use client";

import { useEffect } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function LoginPage() {
  const { showToast } = useToast();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error === "oauth_failed") {
      showToast("Google sign-in failed. Please try again.", "error");
    } else if (error === "oauth_not_configured") {
      showToast("Google login isn't configured on this server yet.", "error");
    }
  }, [showToast]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">ReachInbox Scheduler</h1>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Schedule bulk emails, track sends, and get notified when a sender hits its rate limit.
        </p>
      </div>

      <a
        href={api.loginUrl()}
        className="inline-flex items-center gap-3 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path
            fill="#FFC107"
            d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
          />
          <path
            fill="#FF3D00"
            d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
          />
          <path
            fill="#4CAF50"
            d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 34.8 27 36 24 36c-5.3 0-9.7-3.4-11.3-8l-6.6 5.1C9.6 39.6 16.3 44 24 44z"
          />
          <path
            fill="#1976D2"
            d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.4 36.6 44 30.9 44 24c0-1.3-.1-2.7-.4-3.5z"
          />
        </svg>
        Sign in with Google
      </a>
    </main>
  );
}
