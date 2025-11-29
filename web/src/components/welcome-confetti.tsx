"use client"

import { Confetti } from "@/components/ui/confetti"

export function WelcomeConfetti() {
    return (
        <Confetti
            className="fixed inset-0 z-50 size-full pointer-events-none"
            options={{
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
            }}
        />
    )
}
