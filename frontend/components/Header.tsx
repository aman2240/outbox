"use client";

import { useAuth } from "@/components/AuthContext";
import { SlackConnectButton } from "@/components/SlackConnectButton";
import { Button } from "@/components/ui/Button";

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        {user?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">
            {user?.name?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div className="leading-tight">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{user?.name}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SlackConnectButton />
        <Button variant="ghost" onClick={() => logout()}>
          Logout
        </Button>
      </div>
    </header>
  );
}
