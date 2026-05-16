'use client';

import { WelcomeConfetti } from "./welcome-confetti"
import { EyeTrackingCharacter } from "./eye-tracking-character"
import { TextAnimate } from "./ui/text-animate"
import { FaqsSection } from "./faqs-section"
import { motion } from "motion/react"
import { SignInButton } from "./sign-in-button"
import { LineShadowText } from "./ui/line-shadow-text";
import { ConfettiButton } from "./ui/confetti";
import { WatchDemoButton } from "./watch-demo-button";
import Features from "./features-4";

interface HomeContentProps {
    session: any;
}




export const HomeContent = ({ session }: HomeContentProps) => {
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
                    variants={{ hidden: { scale: 0.8, opacity: 0 }, visible: { scale: 1, opacity: 1 } }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                    <EyeTrackingCharacter size={200} />
                </motion.div>

                {/* Malayalam accent line */}
                <motion.p
                    variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
                    transition={{ duration: 0.8 }}
                    className="text-lg md:text-xl text-muted-foreground font-medium"
                    lang="ml"
                >
                    ഹിസാബ് എഴുതാൻ മറന്നോ?
                </motion.p>

                <motion.div
                    variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
                    transition={{ duration: 0.8 }}
                >
                    <LineShadowText className="italic text-7xl md:text-9xl font-bold">
                        Blipko
                    </LineShadowText>
                </motion.div>

                <motion.div
                    variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
                    transition={{ duration: 0.8 }}
                >
                    <TextAnimate className="text-lg md:text-2xl text-gray-400 max-w-2xl mb-4 font-medium">
                        Track every rupee. Just chat.
                    </TextAnimate>
                    <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto mb-10">
                        Blipko is a Telegram bot that understands Malayalam, Manglish, and English.
                        Say &ldquo;Raju 500 koduthu&rdquo; and it&apos;s logged instantly.
                    </p>
                </motion.div>

                <motion.div
                    variants={{ hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } }}
                    transition={{ duration: 0.8 }}
                >
                    {session?.user ? (
                        <ConfettiButton className="relative p-10 rounded-3xl bg-primary/5 border border-primary/10 backdrop-blur-xl overflow-hidden">
                            <WelcomeConfetti />
                            <TextAnimate className="text-lg md:text-2xl text-gray-400 max-w-2xl font-medium">
                                You are on the list.
                            </TextAnimate>
                        </ConfettiButton>
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
                        Double-entry accounting · Business &amp; organisation ledgers · Receipt uploads · WhatsApp support
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
