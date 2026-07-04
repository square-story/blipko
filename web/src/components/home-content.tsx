'use client';

import { EyeTrackingCharacter } from "./eye-tracking-character"
import { TextAnimate } from "./ui/text-animate"
import { FaqsSection } from "./faqs-section"
import { motion, useReducedMotion } from "motion/react"
import { SignInButton } from "./sign-in-button"
import { LineShadowText } from "./ui/line-shadow-text";
import { WatchDemoButton } from "./watch-demo-button";
import Features from "./features-4";
import Link from "next/link";
import { Send } from "lucide-react";
import type { Session } from "next-auth";

const TELEGRAM_URL = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
    ? `https://t.me/${process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}`
    : "https://t.me/blipko_bot";

interface HomeContentProps {
    session: Session | null;
}




export const HomeContent = ({ session }: HomeContentProps) => {
    // Reduced motion: keep the fades, drop the rise/scale movement.
    const reduce = useReducedMotion();
    const rise = reduce
        ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
        : { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };
    const pop = reduce
        ? { hidden: { opacity: 0 }, visible: { opacity: 1 } }
        : { hidden: { scale: 0.8, opacity: 0 }, visible: { scale: 1, opacity: 1 } };
    return (
        <main className="relative min-h-screen overflow-hidden flex flex-col items-center">
            <div className="fixed inset-0 pointer-events-none -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-green-500/10 blur-[120px] rounded-full animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 blur-[120px] rounded-full" />
            </div>

            {/* Hero Section */}
            <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.15 } } }}
                className="w-full max-w-4xl gap-4 px-6 flex flex-col items-center justify-center text-center mt-24 pt-16 pb-24 relative z-10"
            >
                <motion.div
                    variants={pop}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                    <EyeTrackingCharacter size={200} />
                </motion.div>

                <motion.div
                    variants={rise}
                    transition={{ duration: 0.8 }}
                >
                    <LineShadowText className="italic text-7xl md:text-9xl font-bold">
                        Blipko
                    </LineShadowText>
                </motion.div>

                <motion.div
                    variants={rise}
                    transition={{ duration: 0.8 }}
                >
                    <TextAnimate className="text-lg md:text-2xl text-gray-400 max-w-2xl mb-4 font-medium">
                        Know where your salary goes. Just chat.
                    </TextAnimate>
                    <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto mb-10">
                        Log any spend in plain Malayalam, Manglish, or English — by text or voice.
                        Blipko sorts it into a 50/30/20 budget and tells you what&apos;s left, instantly.
                    </p>
                </motion.div>

                <motion.div
                    variants={rise}
                    transition={{ duration: 0.8 }}
                >
                    {session?.user ? (
                        <div className="flex flex-col items-center justify-center gap-4">
                            <p className="text-lg text-muted-foreground font-medium">
                                Welcome back, {session.user.name || "friend"}! You&apos;re ready to go.
                            </p>
                            <div className="flex flex-col md:flex-row gap-3 items-center">
                                <Link
                                    href={TELEGRAM_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="group relative flex h-12 w-[220px] items-center justify-between rounded-full border-2 border-[#229ED9] bg-[#229ED9] font-medium text-white hover:opacity-90 transition-opacity"
                                >
                                    <span className="pl-5 flex items-center gap-2">
                                        <Send className="h-4 w-4" />
                                        Open in Telegram
                                    </span>
                                </Link>
                                <Link
                                    href="/dashboard"
                                    className="group relative flex h-12 w-[220px] items-center justify-between rounded-full border-2 border-[#394481] bg-primary font-medium text-accent hover:opacity-90 transition-opacity"
                                >
                                    <span className="pl-5">Open Dashboard</span>
                                    <div className="relative mr-1 h-9 w-9 overflow-hidden rounded-full bg-black dark:bg-white">
                                        <div className="absolute top-[0.7em] left-[-0.1em] grid h-full w-full place-content-center transition-all duration-200 group-hover:translate-x-4 group-hover:-translate-y-5">
                                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 fill-white dark:fill-black">
                                                <path d="M3.64645 11.3536C3.45118 11.1583 3.45118 10.8417 3.64645 10.6465L10.2929 4L6 4C5.72386 4 5.5 3.77614 5.5 3.5C5.5 3.22386 5.72386 3 6 3L11.5 3C11.6326 3 11.7598 3.05268 11.8536 3.14645C11.9473 3.24022 12 3.36739 12 3.5L12 9.00001C12 9.27615 11.7761 9.50001 11.5 9.50001C11.2239 9.50001 11 9.27615 11 9.00001V4.70711L4.35355 11.3536C4.15829 11.5488 3.84171 11.5488 3.64645 11.3536Z" fillRule="evenodd" clipRule="evenodd"></path>
                                            </svg>
                                            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="mb-1 h-5 w-5 -translate-x-4 fill-white dark:fill-black">
                                                <path d="M3.64645 11.3536C3.45118 11.1583 3.45118 10.8417 3.64645 10.6465L10.2929 4L6 4C5.72386 4 5.5 3.77614 5.5 3.5C5.5 3.22386 5.72386 3 6 3L11.5 3C11.6326 3 11.7598 3.05268 11.8536 3.14645C11.9473 3.24022 12 3.36739 12 3.5L12 9.00001C12 9.27615 11.7761 9.50001 11.5 9.50001C11.2239 9.50001 11 9.27615 11 9.00001V4.70711L4.35355 11.3536C4.15829 11.5488 3.84171 11.5488 3.64645 11.3536Z" fillRule="evenodd" clipRule="evenodd"></path>
                                            </svg>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
                            <SignInButton />
                            <WatchDemoButton />
                        </div>
                    )}
                </motion.div>
            </motion.div>


            {/* Features Grid */}
            <Features />

            {/* Coming Soon */}
            <motion.section
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="w-full max-w-4xl mx-auto px-6 pb-24"
            >
                <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-5 text-center">
                    <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">On the roadmap:</span>{" "}
                        Savings goals · Recurring bill tracking · Receipt photos · WhatsApp support
                    </p>
                </div>
            </motion.section>

            {/* FAQ Section */}
            <motion.div
                id="faq"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 1.2 }}
                viewport={{ once: true }}
                className="w-full max-w-3xl mx-auto px-6 pb-32 scroll-mt-20"
            >
                <FaqsSection />
            </motion.div>
        </main>
    );
};
