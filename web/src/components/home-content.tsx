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
<<<<<<< HEAD
=======
import { Card, CardContent } from "@/components/ui/card";
>>>>>>> 77ad3d0ef1296d31d8387a8e7f385a32f9fbd731
import { Button } from "@/components/ui/button";
import { LayoutDashboard } from "lucide-react";

interface HomeContentProps {
    session: any;
}

<<<<<<< HEAD
const roadmap = [
    "Double-entry accounting",
    "Business ledgers",
    "Receipt uploads",
    "WhatsApp support",
];

=======
const chatDemo = [
    { from: "user", text: "Raju 500 koduthu" },
    { from: "bot", text: "✅ ₹500 to Raju logged as expense.\nBalance: Raju owes you ₹1,200" },
    { from: "user", text: "Innathe chilavu ethra?" },
    { from: "bot", text: "📊 Today's summary\nTotal spent: ₹1,840\nFood ₹340 · Transport ₹200 · Others ₹1,300" },
];

const roadmap = [
    "Double-entry accounting",
    "Business ledgers",
    "Receipt uploads",
    "WhatsApp support",
];

>>>>>>> 77ad3d0ef1296d31d8387a8e7f385a32f9fbd731
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

<<<<<<< HEAD
                <motion.div variants={fadeUp} transition={{ duration: 0.6 }} className="mt-8">
=======
                <motion.div
                    variants={fadeUp}
                    transition={{ duration: 0.6 }}
                    className="mt-8"
                >
>>>>>>> 77ad3d0ef1296d31d8387a8e7f385a32f9fbd731
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

<<<<<<< HEAD
=======
            {/* Chat Demo */}
            <motion.section
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                transition={{ duration: 0.6 }}
                className="w-full max-w-sm mx-auto px-6 pb-24"
            >
                <Card className="overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
                        <div className="size-2 rounded-full bg-green-500" />
                        <span className="text-sm font-medium">Blipko Bot</span>
                        <span className="text-xs text-muted-foreground ml-auto">Telegram</span>
                    </div>
                    <CardContent className="p-4 flex flex-col gap-3">
                        {chatDemo.map((msg, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, x: msg.from === "user" ? 14 : -14 }}
                                whileInView={{ opacity: 1, x: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.12 }}
                                className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-line ${
                                    msg.from === "user"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-muted text-foreground"
                                }`}>
                                    {msg.text}
                                </div>
                            </motion.div>
                        ))}
                    </CardContent>
                </Card>
            </motion.section>

>>>>>>> 77ad3d0ef1296d31d8387a8e7f385a32f9fbd731
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
