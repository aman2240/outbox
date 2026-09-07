"use client";

import { ReactNode } from "react";
import { AuthProvider, useAuth } from "@/components/AuthContext";
import { Header } from "@/components/Header";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

function DashboardShell({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
