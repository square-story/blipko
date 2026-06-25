"use client";

import { useEffect, useState, useTransition } from "react";
import { useTheme } from "next-themes";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useSoundStore } from "@/hooks/use-sound-store";
import { playSound } from "@/lib/sound";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { updateBudgetSettings } from "@/lib/actions/budget";
import { BUCKET_META, CURRENCIES, DOSAGES } from "@/lib/budget";

export function AppearanceCard() {
    const { theme, setTheme } = useTheme();
    const soundEnabled = useSoundStore((s) => s.enabled);
    const setSoundEnabled = useSoundStore((s) => s.setEnabled);
    const [mounted, setMounted] = useState(false);
    // next-themes: render only after mount to avoid a hydration mismatch on the bound value.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>
                    Customize the look and feel of the application.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="theme">Theme</Label>
                    <Select value={theme} onValueChange={setTheme}>
                        <SelectTrigger id="theme">
                            <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="dark">Dark</SelectItem>
                            <SelectItem value="system">System</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                        <Label htmlFor="sound">Interaction sounds</Label>
                        <p className="text-xs text-muted-foreground">
                            Subtle crisp clicks and chimes as you use the dashboard.
                        </p>
                    </div>
                    <Checkbox
                        id="sound"
                        checked={soundEnabled}
                        onCheckedChange={(v) => {
                            const on = v === true;
                            setSoundEnabled(on);
                            if (on) playSound("tick");
                        }}
                    />
                </div>
            </CardContent>
        </Card>
    );
}

export type NotificationDosage = "OFF" | "GENTLE" | "AGGRESSIVE" | "RELENTLESS";

export type BudgetSettings = {
    monthlyIncome: number;
    payday: number;
    currency: string;
    locale: string;
    needsPct: number;
    wantsPct: number;
    savingsPct: number;
    notificationDosage: NotificationDosage;
};

export function BudgetSettingsCard({ initial }: { initial: BudgetSettings }) {
    const [income, setIncome] = useState(String(initial.monthlyIncome));
    const [payday, setPayday] = useState(String(initial.payday));
    const [currency, setCurrency] = useState(initial.currency);
    const [needs, setNeeds] = useState(initial.needsPct);
    const [wants, setWants] = useState(initial.wantsPct);
    const [savings, setSavings] = useState(initial.savingsPct);
    const [dosage, setDosage] = useState<NotificationDosage>(
        initial.notificationDosage,
    );
    const [isPending, startTransition] = useTransition();

    const sum = needs + wants + savings;
    const splitValid = sum === 100;
    const paydayNum = Number(payday);
    const paydayValid = paydayNum >= 1 && paydayNum <= 28;

    const handleSave = () =>
        startTransition(async () => {
            if (!splitValid) {
                toast.error("The 50/30/20 split must sum to 100%");
                return;
            }
            if (!paydayValid) {
                toast.error("Payday must be between 1 and 28");
                return;
            }
            const locale =
                CURRENCIES.find((c) => c.value === currency)?.locale ?? "en-IN";
            const res = await updateBudgetSettings({
                monthlyIncome: Number(income) || 0,
                payday: paydayNum,
                currency,
                locale,
                needsPct: needs,
                wantsPct: wants,
                savingsPct: savings,
                notificationDosage: dosage,
            });
            if (res.success) {
                toast.success("Budget settings saved");
            } else {
                toast.error(res.message ?? "Failed to save");
            }
        });

    return (
        <Card>
            <CardHeader>
                <CardTitle>Budget Settings</CardTitle>
                <CardDescription>
                    Set your income and how it splits across Needs, Wants, and Savings.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                        <Label htmlFor="income">Monthly Income</Label>
                        <Input
                            id="income"
                            type="number"
                            min={0}
                            value={income}
                            onChange={(e) => setIncome(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="payday">Payday (day of month)</Label>
                        <Input
                            id="payday"
                            type="number"
                            min={1}
                            max={28}
                            value={payday}
                            onChange={(e) => setPayday(e.target.value)}
                        />
                        {!paydayValid && (
                            <p className="text-xs text-destructive">Must be 1–28</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="currency">Currency</Label>
                        <Select value={currency} onValueChange={setCurrency}>
                            <SelectTrigger id="currency">
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
                </div>

                <div className="space-y-2">
                    <Label>
                        Budget Split{" "}
                        <span
                            className={`ml-2 text-xs ${splitValid ? "text-muted-foreground" : "text-destructive"}`}
                        >
                            ({sum}% — must total 100%)
                        </span>
                    </Label>
                    <div className="grid gap-4 md:grid-cols-3">
                        <SplitInput
                            label={`${BUCKET_META.NEEDS.emoji} ${BUCKET_META.NEEDS.label} %`}
                            value={needs}
                            onChange={setNeeds}
                        />
                        <SplitInput
                            label={`${BUCKET_META.WANTS.emoji} ${BUCKET_META.WANTS.label} %`}
                            value={wants}
                            onChange={setWants}
                        />
                        <SplitInput
                            label={`${BUCKET_META.SAVINGS.emoji} ${BUCKET_META.SAVINGS.label} %`}
                            value={savings}
                            onChange={setSavings}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="dosage">Telegram reminders</Label>
                    <Select
                        value={dosage}
                        onValueChange={(v) => setDosage(v as NotificationDosage)}
                    >
                        <SelectTrigger id="dosage">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {DOSAGES.map((d) => (
                                <SelectItem key={d.value} value={d.value}>
                                    {d.label} — {d.hint}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                        How often the bot nudges you when a bucket runs hot.
                    </p>
                </div>

                <Button
                    onClick={handleSave}
                    disabled={isPending || !splitValid || !paydayValid}
                >
                    Save changes
                </Button>
            </CardContent>
        </Card>
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
        <div className="space-y-2">
            <Label>{label}</Label>
            <Input
                type="number"
                min={0}
                max={100}
                value={value}
                onChange={(e) => onChange(Number(e.target.value) || 0)}
            />
        </div>
    );
}
