"use client";

import Image from "next/image";
import { ArrowRightIcon, CheckIcon, ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

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
  submitOnboarding,
  markOnboardingComplete,
  type OnboardingGroup,
} from "@/lib/actions/onboarding";
import { ConnectTelegram } from "@/components/connect-telegram";
import { playSound } from "@/lib/sound";

const TOTAL_STEPS = 4;

export default function Onboarding({
  taxonomy,
}: {
  taxonomy: OnboardingGroup[];
}) {
  // Leaf names of the default-selected groups (pre-checked on first render).
  const defaultLeafNames = taxonomy
    .filter((g) => g.defaultSelected)
    .flatMap((g) => g.children.map((c) => c.name));
  const [step, setStep] = useState(1);
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(true);

  // Step 1
  const [income, setIncome] = useState("");
  const [currency, setCurrency] = useState("INR");
  // Step 2 — selected leaf names + which group cards are expanded
  const [selected, setSelected] = useState<Set<string>>(
    new Set(defaultLeafNames),
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Step 3
  const [dosage, setDosage] = useState<NotificationDosage>("GENTLE");

  const [saving, setSaving] = useState(false);

  const incomeNum = Number(income.replace(/,/g, ""));
  const incomeValid = Number.isFinite(incomeNum) && incomeNum > 0;
  const locale = localeForCurrency(currency);

  const selectedCount = (leaves: { name: string }[]) =>
    leaves.filter((l) => selected.has(l.name)).length;

  const toggleLeaf = (name: string) => {
    playSound("tick");
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  // Expand/collapse a group's chips. Expanding a group with nothing selected
  // auto-selects all its leaves (the "I spend on this → here are the parts"
  // bloom); collapsing keeps the selection.
  const toggleGroup = (key: string, leafNames: string[]) => {
    playSound("tick");
    setExpanded((prev) => {
      const next = new Set(prev);
      const willExpand = !next.has(key);
      if (willExpand) {
        next.add(key);
        if (leafNames.every((n) => !selected.has(n))) {
          setSelected((s) => new Set([...s, ...leafNames]));
        }
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  // Persist everything (income + dosage + categories), then advance to Telegram.
  const saveAndContinue = async () => {
    setSaving(true);
    const res = await submitOnboarding({
      monthlyIncome: incomeNum,
      currency,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      notificationDosage: dosage,
      leafNames: [...selected],
    });
    setSaving(false);
    if (res.success) {
      playSound("celebrate");
      toast.signature("You're all set", {
        description: "Link Telegram to start logging spends",
        silent: true,
      });
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

  // Finishing the wizard (connect Telegram or "Do this later") completes
  // onboarding. Programmatic setOpen(false) doesn't fire Radix's onOpenChange,
  // so mark completion explicitly here.
  const completeAndClose = () => {
    void markOnboardingComplete();
    setOpen(false);
  };

  return (
    <>
      {step === 4 && (
        <Confetti className="fixed inset-0 h-full w-full pointer-events-none z-100" />
      )}
      <Dialog
        open={open}
        onOpenChange={(o) => {
          // Closing from the final (Telegram) step — via Connect, "Do this
          // later", or Escape — is what completes onboarding.
          if (!o && step === 4) void markOnboardingComplete();
          setOpen(o);
        }}
      >
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
                    Tap a group to see what&apos;s inside — pick the bits that
                    fit. We&apos;ll suggest a budget for each.
                  </DialogDescription>
                </DialogHeader>
                <div className="-mx-1 max-h-80 space-y-2 overflow-y-auto px-1">
                  {taxonomy.map((g) => {
                    const leafNames = g.children.map((c) => c.name);
                    const count = selectedCount(g.children);
                    const isExpanded = expanded.has(g.key);
                    return (
                      <div
                        key={g.key}
                        className={cn(
                          "rounded-lg border transition-colors",
                          count > 0 ? "border-primary/60" : "border-border",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => toggleGroup(g.key, leafNames)}
                          className="flex w-full items-center gap-2 p-3 text-left text-sm"
                        >
                          <span
                            className={cn(
                              "flex size-4 shrink-0 items-center justify-center rounded-sm border",
                              count > 0
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-input",
                            )}
                          >
                            {count > 0 && <CheckIcon className="size-3" />}
                          </span>
                          <span className="flex-1 font-medium">{g.name}</span>
                          {count > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {count}/{leafNames.length}
                            </span>
                          )}
                          <ChevronDown
                            className={cn(
                              "size-4 text-muted-foreground transition-transform",
                              isExpanded && "rotate-180",
                            )}
                          />
                        </button>
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              key="chips"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="flex flex-wrap gap-1.5 px-3 pb-3">
                                {g.children.map((c, i) => {
                                  const on = selected.has(c.name);
                                  return (
                                    <motion.button
                                      key={c.name}
                                      type="button"
                                      onClick={() => toggleLeaf(c.name)}
                                      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 4 }}
                                      animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
                                      transition={reduce ? { duration: 0.2 } : { delay: i * 0.03 }}
                                      className={cn(
                                        "rounded-full border px-2.5 py-1 text-xs transition-colors",
                                        on
                                          ? "border-primary bg-primary/10 text-primary"
                                          : "border-input text-muted-foreground hover:bg-muted/50",
                                      )}
                                    >
                                      {on && (
                                        <CheckIcon className="mr-1 inline size-3" />
                                      )}
                                      {c.name}
                                    </motion.button>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
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
                        onClick={() => {
                          playSound("tick");
                          setDosage(dose.value);
                        }}
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
                <ConnectTelegram onConnected={completeAndClose} />
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
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={completeAndClose}
                  >
                    Do this later
                  </Button>
                )}
              </DialogFooter>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
