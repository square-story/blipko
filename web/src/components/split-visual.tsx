"use client";

import { motion } from "motion/react";
import { BUCKETS, BUCKET_META } from "@/lib/budget";

const SPLIT: Record<string, number> = { NEEDS: 50, WANTS: 30, SAVINGS: 20 };
const COLORS: Record<string, string> = {
    NEEDS: "bg-emerald-500",
    WANTS: "bg-violet-500",
    SAVINGS: "bg-amber-500",
};

export function SplitVisual() {
    return (
        <section className="w-full max-w-3xl mx-auto px-6 py-12">
            <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">
                    Every rupee, auto-sorted
                </h2>
                <p className="text-muted-foreground">
                    Your income splits into three simple buckets — the proven 50/30/20 rule.
                </p>
            </div>
            <div className="space-y-4">
                {BUCKETS.map((bucket, i) => {
                    const meta = BUCKET_META[bucket];
                    const pct = SPLIT[bucket];
                    return (
                        <div key={bucket} className="space-y-1">
                            <div className="flex items-center justify-between text-sm font-medium">
                                <span>
                                    {meta.emoji} {meta.label}
                                </span>
                                <span className="text-muted-foreground">{pct}%</span>
                            </div>
                            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
                                <motion.div
                                    initial={{ width: 0 }}
                                    whileInView={{ width: `${pct}%` }}
                                    viewport={{ once: true }}
                                    transition={{ duration: 0.9, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                                    className={`h-3 rounded-full ${COLORS[bucket]}`}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
