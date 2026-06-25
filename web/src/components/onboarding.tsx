"use client";

import Image from "next/image";
import { ArrowRightIcon, SendIcon, CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Confetti } from "@/components/ui/confetti";
import { CATEGORY_TEMPLATE } from "@/lib/category-template";
import {
  BUCKETS,
  BUCKET_META,
  CURRENCIES,
  DEFAULT_SPLIT,
  DOSAGES,
  bucketBudget,
  formatMoney,
  localeForCurrency,
  type NotificationDosage,
} from "@/lib/budget";
import {
  generateTelegramLinkToken,
  getTelegramConnectionStatus,
} from "@/lib/actions/user";
import { submitOnboarding } from "@/lib/actions/onboarding";

const TOTAL_STEPS = 4;

const DEFAULT_GROUPS = new Set(
  CATEGORY_TEMPLATE.filter((g) => g.defaultSelected).map((g) => g.key),
);

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [open, setOpen] = useState(true);

  // Step 1
  const [income, setIncome] = useState("");
  const [currency, setCurrency] = useState("INR");
  // Step 2
  const [groups, setGroups] = useState<Set<string>>(new Set(DEFAULT_GROUPS));
  // Step 3
  const [dosage, setDosage] = useState<NotificationDosage>("GENTLE");

  const [saving, setSaving] = useState(false);
  // Step 4 (Telegram)
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramOpened, setTelegramOpened] = useState(false);
  const [checking, setChecking] = useState(false);
  const [linkMsg, setLinkMsg] = useState<string | null>(null);

  const incomeNum = Number(income.replace(/,/g, ""));
  const incomeValid = Number.isFinite(incomeNum) && incomeNum > 0;
  const locale = localeForCurrency(currency);

  const toggleGroup = (key: string) =>
    setGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Persist everything (income + dosage + categories), then advance to Telegram.
  const saveAndContinue = async () => {
    setSaving(true);
    const res = await submitOnboarding({
      monthlyIncome: incomeNum,
      currency,
      notificationDosage: dosage,
      groupKeys: [...groups],
    });
    setSaving(false);
    if (res.success) {
      setStep(4);
    } else {
      toast.error(res.message ?? "Couldn't save your setup — please try again.");
    }
  };

  const handleNext = () => {
    if (step === 1 && !incomeValid) return;
    if (step < 3) setStep(step + 1);
    else if (step === 3) void saveAndContinue();
  };

  const handleOpenTelegram = async () => {
    setTelegramLoading(true);
    setLinkMsg(null);
    const win = window.open("", "_blank");
    try {
      const url = await generateTelegramLinkToken();
      if (win) win.location.href = url;
      else window.location.href = url;
      setTelegramOpened(true);
    } catch {
      win?.close();
      setLinkMsg("Couldn't open Telegram. Please try again.");
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleVerifyLink = async () => {
    setChecking(true);
    setLinkMsg(null);
    const connected = await getTelegramConnectionStatus();
    setChecking(false);
    if (connected) {
      setOpen(false);
    } else {
      setLinkMsg(
        "We haven't seen your Telegram link yet — open the bot and tap Start, then try again (or finish for now).",
      );
    }
  };

  return (
    <>
      {step === 4 && (
        <Confetti className="fixed inset-0 h-full w-full pointer-events-none z-[100]" />
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="gap-0 p-0 [&>button:last-child]:text-white sm:max-w-[440px]"
          showCloseButton={false}
        >
          <div className="p-2">
            <Image
              alt="Blipko onboarding"
              className="w-full rounded-md object-cover"
              src="/origin/dialog-content.png"
              width={420}
              height={216}
            />
          </div>

          <div className="space-y-5 px-6 pt-3 pb-6">
            {/* Step 1 — income */}
            {step === 1 && (
              <>
                <DialogHeader>
                  <DialogTitle>Welcome to Blipko 👋</DialogTitle>
                  <DialogDescription>
                    Let&apos;s set up your budget. What&apos;s your monthly
                    take-home income?
                  </DialogDescription>
                </DialogHeader>
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="50000"
                    value={income}
                    onChange={(e) => setIncome(e.target.value)}
                    className="text-lg"
                  />
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {incomeValid && (
                  <div className="rounded-lg bg-muted/60 p-3 text-sm">
                    <p className="mb-1 text-xs text-muted-foreground">
                      Your 50/30/20 plan
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      {BUCKETS.map((b) => (
                        <span key={b}>
                          {BUCKET_META[b].emoji} {BUCKET_META[b].label}{" "}
                          <strong>
                            {formatMoney(
                              bucketBudget(incomeNum, DEFAULT_SPLIT, b),
                              currency,
                              locale,
                            )}
                          </strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Step 2 — category groups */}
            {step === 2 && (
              <>
                <DialogHeader>
                  <DialogTitle>What do you spend on?</DialogTitle>
                  <DialogDescription>
                    We&apos;ll set up categories with suggested limits. Tweak any
                    of them later.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_TEMPLATE.map((g) => {
                    const checked = groups.has(g.key);
                    return (
                      <button
                        key={g.key}
                        type="button"
                        onClick={() => toggleGroup(g.key)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors",
                          checked
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                            checked
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-input",
                          )}
                        >
                          {checked && <CheckIcon className="size-3" />}
                        </span>
                        <span>{g.name}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Step 3 — reminder dosage */}
            {step === 3 && (
              <>
                <DialogHeader>
                  <DialogTitle>How should I keep you on track?</DialogTitle>
                  <DialogDescription>
                    Budget reminders over Telegram. Change anytime in settings.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  {DOSAGES.map((dose) => {
                    const selected = dosage === dose.value;
                    return (
                      <button
                        key={dose.value}
                        type="button"
                        onClick={() => setDosage(dose.value)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm transition-colors",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50",
                        )}
                      >
                        <span>
                          <span className="font-medium">{dose.label}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {dose.hint}
                          </span>
                        </span>
                        {selected && <CheckIcon className="size-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Step 4 — Telegram */}
            {step === 4 && (
              <>
                <DialogHeader>
                  <DialogTitle>You&apos;re all set 🎉</DialogTitle>
                  <DialogDescription>
                    Connect Telegram to log spends by text — &quot;chai 30&quot; —
                    and get your reminders. Optional, you can do this later.
                  </DialogDescription>
                </DialogHeader>
                {linkMsg && (
                  <p className="text-sm text-amber-600 dark:text-amber-500">
                    {linkMsg}
                  </p>
                )}
              </>
            )}

            {/* Footer */}
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex justify-center space-x-1.5 max-sm:order-1">
                {[...Array(TOTAL_STEPS)].map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "size-1.5 rounded-full bg-primary transition-all duration-300",
                      i + 1 === step ? "w-3" : "opacity-20",
                    )}
                  />
                ))}
              </div>

              <DialogFooter>
                {step < 4 ? (
                  <>
                    {step > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setStep(step - 1)}
                        disabled={saving}
                      >
                        Back
                      </Button>
                    )}
                    <Button
                      type="button"
                      className="group"
                      onClick={handleNext}
                      disabled={(step === 1 && !incomeValid) || saving}
                    >
                      {saving
                        ? "Saving…"
                        : step === 3
                          ? "Finish setup"
                          : "Next"}
                      {!saving && (
                        <ArrowRightIcon
                          className="-me-1 ml-2 opacity-60 transition-transform group-hover:translate-x-0.5"
                          size={16}
                        />
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setOpen(false)}
                    >
                      {telegramOpened ? "Finish" : "Skip"}
                    </Button>
                    {telegramOpened ? (
                      <Button
                        type="button"
                        onClick={handleVerifyLink}
                        disabled={checking}
                      >
                        {checking ? "Checking…" : "I've linked it"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className="group"
                        onClick={handleOpenTelegram}
                        disabled={telegramLoading}
                      >
                        <SendIcon className="mr-2 size-4" />
                        {telegramLoading ? "Opening…" : "Connect Telegram"}
                      </Button>
                    )}
                  </>
                )}
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
