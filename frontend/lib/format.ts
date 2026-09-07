export function formatRelativeAndAbsolute(iso: string): { relative: string; absolute: string } {
  const date = new Date(iso);
  const absolute = date.toLocaleString();
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const abs = Math.abs(diffSec);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  let relative: string;
  if (abs < 60) relative = rtf.format(diffSec, "second");
  else if (abs < 3600) relative = rtf.format(Math.round(diffSec / 60), "minute");
  else if (abs < 86400) relative = rtf.format(Math.round(diffSec / 3600), "hour");
  else relative = rtf.format(Math.round(diffSec / 86400), "day");

  return { relative, absolute };
}
