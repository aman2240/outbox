// Stub for now — implemented as a runnable script in Phase 9
// (/backend/src/scripts/simulate-load.ts). Kept here as the documented
// starting point referenced from the README's "Behavior Under Load" section.
//
// async function simulateLoad(): Promise<void> {
//   // Create ~1000 email_jobs rows all scheduled at (or very near) the same
//   // timestamp, for a single sender with a low hourly_limit, and schedule
//   // each via the normal scheduleEmailJob path. Most will visibly get
//   // rate-limited into status='delayed' shortly after the worker starts
//   // picking them up, demonstrating rate-limiting behavior under load
//   // without needing 1000 real Ethereal sends.
// }
