"use client";

import { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode, forwardRef, useId } from "react";

const fieldClasses =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

interface FieldWrapperProps {
  label?: string;
  error?: string;
  children: ReactNode;
  htmlFor: string;
}

function FieldWrapper({ label, error, children, htmlFor }: FieldWrapperProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </label>
      )}
      {children}
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }>(
  ({ label, error, id, className = "", ...rest }, ref) => {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    return (
      <FieldWrapper label={label} error={error} htmlFor={fieldId}>
        <input ref={ref} id={fieldId} className={`${fieldClasses} ${className}`} {...rest} />
      </FieldWrapper>
    );
  }
);
Input.displayName = "Input";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string }
>(({ label, error, id, className = "", ...rest }, ref) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldWrapper label={label} error={error} htmlFor={fieldId}>
      <textarea ref={ref} id={fieldId} className={`${fieldClasses} min-h-[120px] resize-y ${className}`} {...rest} />
    </FieldWrapper>
  );
});
Textarea.displayName = "Textarea";

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }
>(({ label, error, id, className = "", children, ...rest }, ref) => {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  return (
    <FieldWrapper label={label} error={error} htmlFor={fieldId}>
      <select ref={ref} id={fieldId} className={`${fieldClasses} ${className}`} {...rest}>
        {children}
      </select>
    </FieldWrapper>
  );
});
Select.displayName = "Select";
