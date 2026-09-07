export function LoadingSpinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600 dark:border-slate-600 dark:border-t-indigo-400 ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}
