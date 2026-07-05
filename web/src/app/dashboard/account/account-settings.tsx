"use client";

import { useEffect, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useTheme } from "next-themes";
import { Wallet, Globe, Bell, Palette, type LucideIcon } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    ResponsiveModal,
    ResponsiveModalContent,
    ResponsiveModalHeader,
    ResponsiveModalTitle,
    ResponsiveModalDescription,
    ResponsiveModalFooter,
} from "@/components/ui/responsive-modal";
import { TimezoneSelect } from "@/components/timezone-select";
import { useSoundStore } from "@/hooks/use-sound-store";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast";
import { updateBudgetSettings } from "@/lib/actions/budget";
import { BUCKET_META, CURRENCIES, DOSAGES } from "@/lib/budget";

export type NotificationDosage = "OFF" | "GENTLE" | "AGGRESSIVE" | "RELENTLESS";

export type BudgetSettings = {
    monthlyIncome: number;
    payday: number;
    currency: string;
    locale: string;
    timezone: string;
    needsPct: number;
    wantsPct: number;
    savingsPct: number;
    notificationDosage: NotificationDosage;
};

// ── Shared layout primitives ──────────────────────────────────────────────────

function SettingsSection({
    icon: Icon,
    title,
    description,
    children,
}: {
    icon: LucideIcon;
    title: string;
    description: string;
    children: ReactNode;
}) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Icon className="size-4 text-muted-foreground" />
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="divide-y">{children}</div>
            </CardContent>
        </Card>
    );
}

// A read-only value row with an Edit button (opens a ResponsiveModal).
function SettingRow({
    label,
    description,
    value,
    onEdit,
}: {
    label: string;
    description?: string;
    value: ReactNode;
    onEdit: () => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
            <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium">{label}</p>
                {description && (
                    <p className="text-xs text-muted-foreground">{description}</p>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-3">
                <span className="max-w-[150px] truncate text-sm text-muted-foreground sm:max-w-[280px]">
                    {value}
                </span>
                <Button variant="outline" size="sm" onClick={onEdit}>
                    Edit
                </Button>
            </div>
        </div>
    );
}

// A row with an inline control on the right (instant settings, no save).
function InlineRow({
    label,
    htmlFor,
    description,
    children,
}: {
    label: string;
    htmlFor?: string;
    description?: string;
    children: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
                <Label htmlFor={htmlFor}>{label}</Label>
                {description && (
                    <p className="text-xs text-muted-foreground">{description}</p>
                )}
            </div>
            <div className="w-full sm:w-64 sm:shrink-0">{children}</div>
        </div>
    );
}

// Reusable edit dialog/drawer with a dirty-gated Save.
function EditModal({
    open,
    onOpenChange,
    title,
    description,
    canSave,
    saving,
    onSave,
    children,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    title: string;
    description?: string;
    canSave: boolean;
    saving: boolean;
    onSave: () => void;
    children: ReactNode;
}) {
    return (
        <ResponsiveModal open={open} onOpenChange={onOpenChange}>
            <ResponsiveModalContent className="sm:max-w-md">
                <ResponsiveModalHeader>
                    <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
                    {description && (
                        <ResponsiveModalDescription>
                            {description}
                        </ResponsiveModalDescription>
                    )}
                </ResponsiveModalHeader>
                <div className="space-y-4 py-2">{children}</div>
                <ResponsiveModalFooter className="gap-2 sm:gap-2">
                    <Button
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={saving}
                    >
                        Cancel
                    </Button>
                    <Button onClick={onSave} disabled={!canSave || saving}>
                        {saving ? "Saving…" : "Save changes"}
                    </Button>
                </ResponsiveModalFooter>
            </ResponsiveModalContent>
        </ResponsiveModal>
    );
}

// ── Section editors ───────────────────────────────────────────────────────────

type BudgetDraft = {
    income: string;
    payday: string;
    needs: number;
    wants: number;
    savings: number;
};

function BudgetRow({ initial }: { initial: BudgetSettings }) {
    const start: BudgetDraft = {
        income: String(initial.monthlyIncome),
        payday: String(initial.payday),
        needs: initial.needsPct,
        wants: initial.wantsPct,
        savings: initial.savingsPct,
    };
    const [committed, setCommitted] = useState<BudgetDraft>(start);
    const [d, setD] = useState<BudgetDraft>(start);
    const [open, setOpen] = useState(false);
    const [saving, startSave] = useTransition();

    const sum = d.needs + d.wants + d.savings;
    const splitValid = sum === 100;
    const paydayNum = Number(d.payday);
    const paydayValid = paydayNum >= 1 && paydayNum <= 28;
    const dirty = JSON.stringify(d) !== JSON.stringify(committed);
    const canSave = dirty && splitValid && paydayValid;

    const money = new Intl.NumberFormat(initial.locale, {
        style: "currency",
        currency: initial.currency,
        maximumFractionDigits: 0,
    });

    const openModal = () => {
        setD(committed);
        setOpen(true);
    };
    const save = () =>
        startSave(async () => {
            const res = await updateBudgetSettings({
                monthlyIncome: Number(d.income) || 0,
                payday: paydayNum,
                needsPct: d.needs,
                wantsPct: d.wants,
                savingsPct: d.savings,
            });
            if (res.success) {
                setCommitted(d);
                setOpen(false);
                toast.signature("Budget saved", {
                    description: "Your 50/30/20 split is updated",
                });
            } else {
                toast.error(res.message ?? "Failed to save");
            }
        });

    return (
        <>
            <SettingRow
                label="Budget"
                description="Monthly income, payday, and how it splits."
                value={`${money.format(Number(committed.income) || 0)} · Day ${committed.payday} · ${committed.needs}/${committed.wants}/${committed.savings}`}
                onEdit={openModal}
            />
            <EditModal
                open={open}
                onOpenChange={setOpen}
                title="Budget"
                description="Set your income, cycle day, and 50/30/20 split."
                canSave={canSave}
                saving={saving}
                onSave={save}
            >
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="income">Monthly income</Label>
                        <Input
                            id="income"
                            type="number"
                            min={0}
                            value={d.income}
                            onChange={(e) =>
                                setD({ ...d, income: e.target.value })
                            }
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="payday">Payday</Label>
                        <Input
                            id="payday"
                            type="number"
                            min={1}
                            max={28}
                            value={d.payday}
                            onChange={(e) =>
                                setD({ ...d, payday: e.target.value })
                            }
                            aria-invalid={!paydayValid}
                        />
                        {!paydayValid && (
                            <p className="text-xs text-destructive">Must be 1–28</p>
                        )}
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <Label>Budget split</Label>
                        <Badge
                            variant={splitValid ? "outline" : "destructive"}
                            className={cn(
                                splitValid && "border-green-600 text-green-600",
                            )}
                        >
                            {sum}%{splitValid ? "" : " · must total 100%"}
                        </Badge>
                    </div>
                    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                            className="bg-primary"
                            style={{
                                width: `${Math.max(0, Math.min(100, d.needs))}%`,
                            }}
                        />
                        <div
                            className="bg-primary/60"
                            style={{
                                width: `${Math.max(0, Math.min(100, d.wants))}%`,
                            }}
                        />
                        <div
                            className="bg-primary/30"
                            style={{
                                width: `${Math.max(0, Math.min(100, d.savings))}%`,
                            }}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <SplitInput
                            label={`${BUCKET_META.NEEDS.emoji} ${BUCKET_META.NEEDS.label}`}
                            value={d.needs}
                            onChange={(n) => setD({ ...d, needs: n })}
                        />
                        <SplitInput
                            label={`${BUCKET_META.WANTS.emoji} ${BUCKET_META.WANTS.label}`}
                            value={d.wants}
                            onChange={(n) => setD({ ...d, wants: n })}
                        />
                        <SplitInput
                            label={`${BUCKET_META.SAVINGS.emoji} ${BUCKET_META.SAVINGS.label}`}
                            value={d.savings}
                            onChange={(n) => setD({ ...d, savings: n })}
                        />
                    </div>
                </div>
            </EditModal>
        </>
    );
}

function CurrencyRow({ initial }: { initial: string }) {
    const [committed, setCommitted] = useState(initial);
    const [draft, setDraft] = useState(initial);
    const [open, setOpen] = useState(false);
    const [saving, startSave] = useTransition();
    const label = CURRENCIES.find((c) => c.value === committed)?.label ?? committed;

    const openModal = () => {
        setDraft(committed);
        setOpen(true);
    };
    const save = () =>
        startSave(async () => {
            const locale =
                CURRENCIES.find((c) => c.value === draft)?.locale ?? "en-IN";
            const res = await updateBudgetSettings({ currency: draft, locale });
            if (res.success) {
                setCommitted(draft);
                setOpen(false);
                toast.success("Currency updated");
            } else {
                toast.error(res.message ?? "Failed to save");
            }
        });

    return (
        <>
            <SettingRow
                label="Currency"
                description="Used to format all amounts."
                value={label}
                onEdit={openModal}
            />
            <EditModal
                open={open}
                onOpenChange={setOpen}
                title="Currency"
                canSave={draft !== committed}
                saving={saving}
                onSave={save}
            >
                <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select value={draft} onValueChange={setDraft}>
                        <SelectTrigger id="currency" className="w-full">
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
            </EditModal>
        </>
    );
}

function TimezoneRow({ initial }: { initial: string }) {
    const [committed, setCommitted] = useState(initial);
    const [draft, setDraft] = useState(initial);
    const [open, setOpen] = useState(false);
    const [saving, startSave] = useTransition();

    const openModal = () => {
        setDraft(committed);
        setOpen(true);
    };
    const save = () =>
        startSave(async () => {
            const res = await updateBudgetSettings({ timezone: draft });
            if (res.success) {
                setCommitted(draft);
                setOpen(false);
                toast.success("Timezone updated");
            } else {
                toast.error(res.message ?? "Failed to save");
            }
        });

    return (
        <>
            <SettingRow
                label="Timezone"
                description="When reminders, recurring items, and the cycle report fire."
                value={committed}
                onEdit={openModal}
            />
            <EditModal
                open={open}
                onOpenChange={setOpen}
                title="Timezone"
                canSave={draft !== committed}
                saving={saving}
                onSave={save}
            >
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <Label>Timezone</Label>
                        <button
                            type="button"
                            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                            onClick={() =>
                                setDraft(
                                    Intl.DateTimeFormat().resolvedOptions()
                                        .timeZone,
                                )
                            }
                        >
                            Use device
                        </button>
                    </div>
                    <TimezoneSelect value={draft} onChange={setDraft} />
                </div>
            </EditModal>
        </>
    );
}

function ReminderRow({ initial }: { initial: NotificationDosage }) {
    const [committed, setCommitted] = useState(initial);
    const [draft, setDraft] = useState(initial);
    const [open, setOpen] = useState(false);
    const [saving, startSave] = useTransition();
    const label = DOSAGES.find((x) => x.value === committed)?.label ?? committed;

    const openModal = () => {
        setDraft(committed);
        setOpen(true);
    };
    const save = () =>
        startSave(async () => {
            const res = await updateBudgetSettings({ notificationDosage: draft });
            if (res.success) {
                setCommitted(draft);
                setOpen(false);
                toast.success("Reminders updated");
            } else {
                toast.error(res.message ?? "Failed to save");
            }
        });

    return (
        <>
            <SettingRow
                label="Reminder frequency"
                description="How often the bot nudges you when a bucket runs hot."
                value={label}
                onEdit={openModal}
            />
            <EditModal
                open={open}
                onOpenChange={setOpen}
                title="Reminder frequency"
                canSave={draft !== committed}
                saving={saving}
                onSave={save}
            >
                <div className="space-y-2">
                    <Label htmlFor="dosage">Frequency</Label>
                    <Select
                        value={draft}
                        onValueChange={(v) => setDraft(v as NotificationDosage)}
                    >
                        <SelectTrigger id="dosage" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {DOSAGES.map((x) => (
                                <SelectItem key={x.value} value={x.value}>
                                    {x.label} — {x.hint}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </EditModal>
        </>
    );
}

// ── Composed sections ─────────────────────────────────────────────────────────

export function AccountSettings({ initial }: { initial: BudgetSettings }) {
    return (
        <>
            <SettingsSection
                icon={Wallet}
                title="Budget"
                description="Income, cycle, and how it splits across your buckets."
            >
                <BudgetRow initial={initial} />
            </SettingsSection>

            <SettingsSection
                icon={Globe}
                title="Preferences"
                description="Regional formatting and scheduling."
            >
                <CurrencyRow initial={initial.currency} />
                <TimezoneRow initial={initial.timezone} />
            </SettingsSection>

            <SettingsSection
                icon={Bell}
                title="Notifications"
                description="How the Blipko bot keeps you on track."
            >
                <ReminderRow initial={initial.notificationDosage} />
            </SettingsSection>
        </>
    );
}

export function AppearanceCard() {
    const { theme, setTheme } = useTheme();
    const soundEnabled = useSoundStore((s) => s.enabled);
    const setSoundEnabled = useSoundStore((s) => s.setEnabled);
    const [mounted, setMounted] = useState(false);
    // next-themes: render only after mount to avoid a hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    return (
        <SettingsSection
            icon={Palette}
            title="Appearance"
            description="Customize the look and feel of the dashboard."
        >
            <InlineRow htmlFor="theme" label="Theme">
                <Select value={theme} onValueChange={setTheme}>
                    <SelectTrigger id="theme" className="w-full">
                        <SelectValue placeholder="Select theme" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                    </SelectContent>
                </Select>
            </InlineRow>

            <InlineRow
                htmlFor="sound"
                label="Interaction sounds"
                description="Subtle crisp clicks and chimes as you use the dashboard."
            >
                <div className="flex sm:justify-end">
                    <Switch
                        id="sound"
                        checked={soundEnabled}
                        onCheckedChange={(v) => setSoundEnabled(v)}
                    />
                </div>
            </InlineRow>
        </SettingsSection>
    );
}

function SplitInput({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number;
    onChange: (n: number) => void;
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-xs font-normal text-muted-foreground">
                {label}
            </Label>
            <div className="relative">
                <Input
                    type="number"
                    min={0}
                    max={100}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value) || 0)}
                    className="pr-7"
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
                    %
                </span>
            </div>
        </div>
    );
}
