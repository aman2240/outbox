"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { api, ApiError } from "@/lib/api";
import { parseRecipientsFile } from "@/lib/parseRecipients";
import { Sender } from "@/lib/types";

const DEFAULT_DELAY_MS = 2000; // matches the backend's MIN_DELAY_MS_BETWEEN_SENDS default

interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  senders: Sender[];
  onScheduled: () => void;
}

export function ComposeModal({ open, onClose, senders, onScheduled }: ComposeModalProps) {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [senderId, setSenderId] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [fileName, setFileName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [delayMs, setDelayMs] = useState<number>(DEFAULT_DELAY_MS);
  const [hourlyLimit, setHourlyLimit] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Derived rather than synced via an effect: defaults to the first sender
  // until the user picks one explicitly.
  const effectiveSenderId = senderId || senders[0]?.id || "";
  const currentSender = senders.find((s) => s.id === effectiveSenderId);

  const handleFile = async (file: File) => {
    const text = await file.text();
    const { valid, invalidCount } = parseRecipientsFile(text);
    setRecipients(valid);
    setSkippedCount(invalidCount);
    setFileName(file.name);
  };

  const resetAndClose = () => {
    setSubject("");
    setBody("");
    setRecipients([]);
    setSkippedCount(0);
    setFileName("");
    setStartTime("");
    setDelayMs(DEFAULT_DELAY_MS);
    setHourlyLimit("");
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!effectiveSenderId) newErrors.senderId = "Select a sender";
    if (!subject.trim()) newErrors.subject = "Subject is required";
    if (!body.trim()) newErrors.body = "Body is required";
    if (recipients.length === 0) newErrors.recipients = "Upload a file with at least one valid email address";
    if (!startTime) newErrors.startTime = "Start time is required";
    else if (new Date(startTime).getTime() <= Date.now()) newErrors.startTime = "Start time must be in the future";
    if (!delayMs || delayMs <= 0) newErrors.delayMs = "Delay must be a positive number";
    if (hourlyLimit !== "" && hourlyLimit <= 0) newErrors.hourlyLimit = "Hourly limit must be a positive number";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await api.scheduleEmails({
        senderId: effectiveSenderId,
        subject,
        body,
        recipients,
        startTime: new Date(startTime).toISOString(),
        delayBetweenEmailsMs: delayMs,
        hourlyLimit: hourlyLimit === "" ? undefined : hourlyLimit,
      });
      showToast(`${res.count} emails scheduled`, "success");
      onScheduled();
      resetAndClose();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : "Failed to schedule emails", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={resetAndClose} title="Compose New Email" widthClassName="max-w-xl">
      <div className="flex flex-col gap-4">
        <Select
          label="Sender"
          value={effectiveSenderId}
          onChange={(e) => setSenderId(e.target.value)}
          error={errors.senderId}
        >
          <option value="" disabled>
            Select a sender
          </option>
          {senders.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.email})
            </option>
          ))}
        </Select>

        <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} error={errors.subject} />
        <Textarea label="Body" value={body} onChange={(e) => setBody(e.target.value)} error={errors.body} />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-200">Recipients (.csv or .txt)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm dark:text-slate-300 dark:file:bg-slate-700"
          />
          {fileName && (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {recipients.length} email address{recipients.length === 1 ? "" : "es"} detected from {fileName}
              {skippedCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400"> — {skippedCount} invalid entries skipped</span>
              )}
            </p>
          )}
          {errors.recipients && <span className="text-xs text-red-600 dark:text-red-400">{errors.recipients}</span>}
        </div>

        <Input
          label="Start time"
          type="datetime-local"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          error={errors.startTime}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Delay between emails (ms)"
            type="number"
            min={0}
            value={delayMs}
            onChange={(e) => setDelayMs(Number(e.target.value))}
            error={errors.delayMs}
          />
          <Input
            label="Hourly limit"
            type="number"
            min={1}
            placeholder={currentSender ? String(currentSender.hourly_limit) : undefined}
            value={hourlyLimit}
            onChange={(e) => setHourlyLimit(e.target.value === "" ? "" : Number(e.target.value))}
            error={errors.hourlyLimit}
          />
        </div>

        <div className="mt-2 flex justify-end gap-3">
          <Button variant="secondary" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Schedule Emails
          </Button>
        </div>
      </div>
    </Modal>
  );
}
