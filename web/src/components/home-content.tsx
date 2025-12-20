'use client';

import { WelcomeConfetti } from "./welcome-confetti"
import { ConfettiText } from "./confetti-text"
import { EyeTrackingCharacter } from "./eye-tracking-character"
import { TextAnimate } from "./ui/text-animate"
import { FaqsSection } from "./faqs-section"
import { motion } from "framer-motion"
import Image from "next/image"
import { SignInButton } from "./sign-in-button"
import { GravityStarsBackground } from "../components/animate-ui/components/backgrounds/gravity-stars"
import { MorphingText } from "./ui/morphing-text";
import { LineShadowText } from "./ui/line-shadow-text";
import { ConfettiButton } from "./ui/confetti";

interface HomeContentProps {
    session: any; // Using any for now to match current usage, can be refined to Session | null
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
                variants={{
                    visible: { transition: { staggerChildren: 0.15 } }
                }}
                className="flex-1 w-full max-w-4xl gap-4 px-6 flex flex-col items-center justify-center text-center mt-24 pt-16 pb-24 relative z-10"
            >
                <motion.div
                    variants={{
                        hidden: { scale: 0.8, opacity: 0 },
                        visible: { scale: 1, opacity: 1 }
                    }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                >
                    <EyeTrackingCharacter size={200} />
                </motion.div>

                <motion.div
                    variants={{
                        hidden: { y: 20, opacity: 0 },
                        visible: { y: 0, opacity: 1 }
                    }}
                    transition={{ duration: 0.8 }}
                >
                    <LineShadowText className="italic text-9xl font-bold">
                        Blipko
                    </LineShadowText>
                </motion.div>

                <motion.div
                    variants={{
                        hidden: { y: 20, opacity: 0 },
                        visible: { y: 0, opacity: 1 }
                    }}
                    transition={{ duration: 0.8 }}
                >
                    <TextAnimate className="text-lg md:text-2xl text-gray-400 max-w-2xl mb-12 font-medium">
                        Manage money as easy as chat.
                    </TextAnimate>
                </motion.div>

                <motion.div
                    variants={{
                        hidden: { y: 20, opacity: 0 },
                        visible: { y: 0, opacity: 1 }
                    }}
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
                        <SignInButton />
                    )}
                </motion.div>

                {/* FAQ Section with subtle entry */}
                <motion.div
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    transition={{ duration: 1.5 }}
                    viewport={{ once: true }}
                    className="mt-32 w-full max-w-3xl"
                >
                    <FaqsSection />
                </motion.div>
            </motion.div>
        </main>
    );
};
