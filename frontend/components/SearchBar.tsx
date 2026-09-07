"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";

export function SearchBar({ onChange }: { onChange: (value: string) => void }) {
  const [local, setLocal] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => onChange(local), 300);
    return () => clearTimeout(handle);
  }, [local, onChange]);

  return (
    <Input
      placeholder="Search by subject, body, or recipient..."
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      className="max-w-sm"
    />
  );
}
