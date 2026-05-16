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

interface HomeContentProps {
    session: any;
}

const features = [
    {
        icon: "🗣️",
        title: "Chat in Your Language",
        body: "Works with Manglish, English, and Hindi. Say \"rent koduthu\" or \"salary kitti\" — Blipko understands.",
    },
    {
        icon: "🎙️",
        title: "Voice Notes Too",
        body: "Send a voice note in Malayalam. Sarvam AI transcribes it instantly. No typing needed.",
    },
    {
        icon: "🔔",
        title: "Never Miss Rent Day",
        body: "Set recurring dues once. Get a Telegram reminder every month at 9 AM with a one-tap Mark Paid button.",
    },
    {
        icon: "👨‍👩‍👧",
        title: "Family Finance Together",
        body: "Create a group with an invite code. Track who spent what — perfect for shared households and small businesses.",
    },
    {
        icon: "💳",
        title: "Multiple Wallets",
        body: "Separate Personal, Business, and Savings. Prefix your message: \"Shop: Raju 500 koduthu\" to log to the right wallet.",
    },
    {
        icon: "📊",
        title: "Dashboard on Web",
        body: "View analytics, manage vendors, and check recurring charges from any browser — no app install needed.",
    },
];

const chatDemo = [
    { from: "user", text: "Raju 500 koduthu" },
    { from: "bot", text: "✅ ₹500 to Raju logged as expense.\nBalance: Raju owes you ₹1,200" },
    { from: "user", text: "Innathe chilavu ethra?" },
    { from: "bot", text: "📊 Today's summary\nTotal spent: ₹1,840\nFood ₹340 · Transport ₹200 · Others ₹1,300" },
];

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

            {/* Live Chat Demo */}
            <motion.section
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7 }}
                className="w-full max-w-md mx-auto px-6 pb-24"
            >
                <div className="rounded-2xl border bg-card/60 backdrop-blur-sm overflow-hidden shadow-lg">
                    <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span className="text-sm font-medium">Blipko Bot</span>
                        <span className="text-xs text-muted-foreground ml-auto">Telegram</span>
                    </div>
                    <div className="p-4 space-y-3">
                        {chatDemo.map((msg, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: msg.from === "user" ? 20 : -20 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.15 }}
                                className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-line ${
                                        msg.from === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-foreground"
                                    }`}
                                >
                                    {msg.text}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </motion.section>

            {/* Features Grid */}
            <motion.section
                id="features"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="w-full max-w-5xl mx-auto px-6 pb-24 scroll-mt-20"
            >
                <div className="text-center mb-12">
                    <h2 className="text-3xl md:text-4xl font-bold mb-3">Everything you need</h2>
                    <p className="text-muted-foreground text-lg">Built for Keralites. Works wherever you are.</p>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {features.map((f, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.08 }}
                            className="rounded-xl border bg-card/60 backdrop-blur-sm p-6 hover:shadow-md transition-shadow"
                        >
                            <div className="text-3xl mb-3">{f.icon}</div>
                            <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                        </motion.div>
                    ))}
                </div>
            </motion.section>

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
