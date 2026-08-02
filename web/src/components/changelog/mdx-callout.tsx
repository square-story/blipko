import { cn } from "@/lib/utils";

type CalloutVariant = "info" | "success" | "warning" | "error";

// Reuses the semantic status tokens already defined for both themes in
// globals.css — no new colors.
const VARIANTS: Record<CalloutVariant, string> = {
  info: "bg-[var(--info)] text-[var(--info-foreground)] border-[var(--info-border)]",
  success:
    "bg-[var(--success)] text-[var(--success-foreground)] border-[var(--success-border)]",
  warning:
    "bg-[var(--warning)] text-[var(--warning-foreground)] border-[var(--warning-border)]",
  error:
    "bg-[var(--error)] text-[var(--error-foreground)] border-[var(--error-border)]",
};

export function MdxCallout({
  variant = "info",
  children,
}: {
  variant?: CalloutVariant;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "not-prose my-6 rounded-md border px-4 py-3 text-sm [&>p]:m-0 [&_strong]:font-semibold",
        VARIANTS[variant],
      )}
    >
      {children}
    </div>
  );
}
