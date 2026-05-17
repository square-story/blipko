'use client';

import { EyeTrackingCharacter } from "./eye-tracking-character"
import { TextAnimate } from "./ui/text-animate"
import { FaqsSection } from "./faqs-section"
import { motion } from "motion/react"
import { SignInButton } from "./sign-in-button"
import { LineShadowText } from "./ui/line-shadow-text";
import { WatchDemoButton } from "./watch-demo-button";
import Features from "./features-4";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";

interface HomeContentProps {
    session: any;
}

const roadmap = [
    "Double-entry accounting",
    "Business ledgers",
    "Receipt uploads",
    "WhatsApp support",
];

const fadeUp = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } };

export const HomeContent = ({ session }: HomeContentProps) => {
    return (
        <main className="relative min-h-screen flex flex-col items-center bg-gradient-to-b from-background via-background to-muted/20">

            {/* Hero */}
            <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
                className="w-full max-w-4xl px-6 flex flex-col items-center justify-center text-center mt-24 pt-16 pb-24"
            >
                <motion.div variants={fadeUp} transition={{ duration: 0.7 }}>
                    <EyeTrackingCharacter size={180} />
                </motion.div>

                <motion.p
                    variants={fadeUp}
                    transition={{ duration: 0.6 }}
                    className="mt-6 text-lg md:text-xl text-muted-foreground font-medium"
                    lang="ml"
                >
                    ഹിസാബ് എഴുതാൻ മറന്നോ?
                </motion.p>

                <motion.div variants={fadeUp} transition={{ duration: 0.6 }}>
                    <LineShadowText className="italic text-7xl md:text-9xl font-bold">
                        Blipko
                    </LineShadowText>
                </motion.div>

                <motion.div variants={fadeUp} transition={{ duration: 0.6 }} className="flex flex-col items-center gap-3 mt-2">
                    <TextAnimate className="text-lg md:text-2xl text-muted-foreground max-w-2xl font-medium">
                        Track every rupee. Just chat.
                    </TextAnimate>
                    <p className="text-sm md:text-base text-muted-foreground max-w-xl">
                        Blipko is a Telegram bot that understands Malayalam, Manglish, and English.
                        Say &ldquo;Raju 500 koduthu&rdquo; and it&apos;s logged instantly.
                    </p>
                    <Badge variant="secondary">Free · Early Access</Badge>
                </motion.div>

                <motion.div variants={fadeUp} transition={{ duration: 0.6 }} className="mt-8">
                    {session?.user ? (
                        <div className="flex flex-col items-center gap-4">
                            <p className="text-base text-muted-foreground">
                                Welcome back, {session.user.name || "friend"}!
                            </p>
                            <Button asChild size="lg" className="rounded-full">
                                <Link href="/dashboard">
                                    <LayoutDashboard data-icon="inline-start" />
                                    Open Dashboard
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row gap-3 items-center justify-center">
                            <SignInButton />
                            <WatchDemoButton />
                        </div>
                    )}
                </motion.div>
            </motion.div>

            {/* Features */}
            <Features />

            <Separator className="max-w-5xl mx-auto w-full opacity-40 my-4" />

            {/* Roadmap */}
            <motion.section
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                transition={{ duration: 0.6 }}
                className="w-full max-w-4xl mx-auto px-6 py-10"
            >
                <p className="text-sm text-center text-muted-foreground mb-4 font-medium">On the roadmap</p>
                <div className="flex flex-wrap justify-center gap-2">
                    {roadmap.map((item) => (
                        <Badge key={item} variant="outline">{item}</Badge>
                    ))}
                </div>
            </motion.section>

            <Separator className="max-w-5xl mx-auto w-full opacity-40 my-4" />

            {/* FAQ */}
            <motion.div
                id="faq"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                transition={{ duration: 0.6 }}
                className="w-full max-w-3xl mx-auto px-6 pb-32 scroll-mt-20"
            >
                <FaqsSection />
            </motion.div>
        </main>
    );
};
