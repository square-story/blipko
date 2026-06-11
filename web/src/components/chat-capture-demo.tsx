"use client";

import { motion } from "motion/react";
import { Card } from "@/components/ui/card";

export function ChatCaptureDemo() {
    return (
        <section className="w-full max-w-2xl mx-auto px-6 py-12">
            <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold mb-2">
                    Just type what you spent
                </h2>
                <p className="text-muted-foreground">
                    No forms, no categories to pick. Blipko sorts it and tells you what&apos;s left.
                </p>
            </div>

            <Card className="p-4 md:p-6 space-y-3 bg-card/60 backdrop-blur-sm">
                {/* User message */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4 }}
                    className="flex justify-end"
                >
                    <div className="rounded-2xl rounded-br-sm bg-[#229ED9] px-4 py-2 text-white text-sm">
                        lunch 220
                    </div>
                </motion.div>

                {/* Bot reply */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: 0.4 }}
                    className="flex justify-start"
                >
                    <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3 text-sm space-y-1 max-w-[80%]">
                        <div className="font-medium">✅ ₹220 → Wants · Food</div>
                        <div className="text-muted-foreground">
                            Wants left this month: ₹14,780 / ₹15,000
                        </div>
                    </div>
                </motion.div>
            </Card>
        </section>
    );
}
