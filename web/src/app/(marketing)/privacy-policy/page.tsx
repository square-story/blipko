"use client";

import { motion, useScroll, useSpring } from "motion/react";
import { ArrowRight, Bot, FileText, Lock, Shield, User } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

const sections = [
    { id: "info-collect", title: "Information We Collect", icon: FileText },
    { id: "usage", title: "How We Use Your Information", icon: User },
    { id: "ai-processors", title: "Third-Party AI Processors", icon: Bot },
    { id: "protection", title: "Data Protection", icon: Shield },
    { id: "cookies", title: "Cookies & Tracking", icon: Lock },
    { id: "dpdp", title: "India DPDP Act 2023", icon: Shield },
    { id: "rights", title: "Your Rights", icon: ArrowRight },
];

export default function PrivacyPolicyPage() {
    const [activeSection, setActiveSection] = useState("");
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001,
    });

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setActiveSection(entry.target.id);
                    }
                });
            },
            { threshold: 0.5, rootMargin: "-20% 0px -35% 0px" }
        );

        sections.forEach(({ id }) => {
            const element = document.getElementById(id);
            if (element) observer.observe(element);
        });

        return () => observer.disconnect();
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
            {/* Scroll Progress Bar */}
            <motion.div
                className="fixed top-0 left-0 right-0 h-1 bg-primary origin-left z-50"
                style={{ scaleX }}
            />

            <div className="container mx-auto px-4 py-20 lg:py-32 relative z-10">
                <div className="grid lg:grid-cols-[1fr_300px] gap-12">

                    {/* Main Content */}
                    <main>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="mb-16"
                        >
                            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-linear-to-r from-primary to-blue-600 mb-6">
                                Privacy Policy
                            </h1>
                            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
                                We value your trust and are committed to protecting your personal information.
                                This policy outlines how Blipko handles your data with transparency and care.
                            </p>
                            <div className="mt-8 text-sm text-muted-foreground">
                                Effective: August 2, 2026 &middot; Last updated: August 2, 2026
                            </div>
                        </motion.div>

                        <div className="space-y-24">
                            {/* Information We Collect */}
                            <Section id="info-collect" title="Information We Collect" delay={0.1}>
                                <p>
                                    We collect information you provide directly to us when you create an account,
                                    interact with the Blipko Telegram bot, or use the web dashboard. This includes:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 mt-4 text-muted-foreground">
                                    <li><strong>Personal Identification:</strong> Name and email address (from Google sign-in).</li>
                                    <li><strong>Telegram Identity:</strong> Your Telegram user ID and username, collected when you link your Telegram account.</li>
                                    <li><strong>Transaction Data:</strong> The amounts, categories, notes and dates of the expenses and income you log, plus the original text of the message you sent, which we keep alongside the entry so you can see how it was interpreted.</li>
                                    <li><strong>Voice Notes:</strong> Audio files you send to the bot for voice-to-text transcription. The audio is written to temporary storage during transcription and deleted immediately afterwards; the resulting text is kept.</li>
                                    <li><strong>Chat History:</strong> Your recent messages to the bot and its replies, used to give the AI context on follow-up questions.</li>
                                    <li><strong>Parse Logs:</strong> For every message the AI interprets, we store the original text, the structured result, and a confidence score. This is what lets us find and fix cases where the bot misread you.</li>
                                    <li><strong>Budget Settings:</strong> Your monthly income, payday, currency, timezone, bucket split and per-category budgets.</li>
                                    <li><strong>Usage Data:</strong> Page-view analytics for the web dashboard, collected via Vercel Analytics. Hosting and application logs are handled by Railway.</li>
                                </ul>
                            </Section>

                            {/* How We Use Your Information */}
                            <Section id="usage" title="How We Use Your Information" delay={0.2}>
                                <p>
                                    We use the collected data to provide, maintain, and improve our services.
                                    Specific use cases include:
                                </p>
                                <div className="grid sm:grid-cols-2 gap-4 mt-6">
                                    <Card title="Service Delivery" description="To authenticate users, process transactions, and power the Telegram bot." />
                                    <Card title="Communication" description="To send Telegram reminders for recurring dues and account notifications." />
                                    <Card title="Improvement" description="To review cases where the bot misread a message and improve how it interprets them." />
                                    <Card title="Security" description="To rate-limit abuse, prevent duplicate processing, and keep accounts separate." />
                                </div>
                            </Section>

                            {/* Third-Party AI Processors */}
                            <Section id="ai-processors" title="Third-Party Services" delay={0.3}>
                                <p>
                                    To understand a message like &ldquo;chai 30&rdquo;, Blipko sends it to an AI
                                    service. This is unavoidable — it is how the product works. These are the
                                    services that receive your data, and what each one gets:
                                </p>
                                <ul className="list-disc pl-6 space-y-3 mt-4 text-muted-foreground">
                                    <li>
                                        <strong>OpenAI</strong> — The primary parser. Receives the text of your
                                        message, your category names, and your recent chat history for context.
                                        If you ask the bot a question about your spending, it also receives the
                                        results of read-only queries against your own financial data.
                                    </li>
                                    <li>
                                        <strong>Google Gemini</strong> — The fallback parser, used only when
                                        OpenAI is unavailable or times out. Receives the same information.
                                    </li>
                                    <li>
                                        <strong>Sarvam AI</strong> — Voice-to-text transcription for Indian
                                        languages. Receives the audio of any voice note you send.
                                    </li>
                                    <li>
                                        <strong>Telegram</strong> — Every message you send and every reply the
                                        bot sends, including amounts and balances, travels over Telegram.
                                    </li>
                                    <li>
                                        <strong>Google</strong> — Handles sign-in, and provides your name, email
                                        and profile picture.
                                    </li>
                                    <li>
                                        <strong>Resend</strong> — Receives your name and email address to send
                                        the welcome email when you first sign in.
                                    </li>
                                    <li>
                                        <strong>Railway</strong> — Hosts the application and the database, and
                                        processes server logs.
                                    </li>
                                    <li>
                                        <strong>Vercel Analytics</strong> — Anonymous page-view analytics on the
                                        web dashboard.
                                    </li>
                                </ul>
                                <p className="mt-4">
                                    Your data is sent to these processors solely to operate Blipko.
                                    <strong> We do not sell your data to anyone.</strong> Each processor handles
                                    what it receives under its own privacy policy and terms, including whether
                                    they retain it — we would encourage you to read OpenAI&rsquo;s and
                                    Google&rsquo;s if that matters to you.
                                </p>
                                <p className="mt-4">
                                    Several of these providers operate outside India, so using Blipko involves
                                    transferring your data internationally.
                                </p>
                            </Section>

                            {/* Data Protection */}
                            <Section id="protection" title="Data Protection & Retention" delay={0.4}>
                                <p>
                                    Your data is stored in a managed Postgres database, reachable only by the
                                    application. Traffic is served over HTTPS, every record is scoped to your
                                    account, and the Telegram webhook is verified with a shared secret so
                                    nobody else can post messages as you.
                                </p>
                                <p className="mt-4">
                                    No method of transmission or storage is completely secure, and we
                                    cannot guarantee absolute security. Blipko is an early-access project run
                                    by one person; please weigh that when deciding what to record in it.
                                </p>
                                <p className="mt-4">
                                    <strong>How long we keep things.</strong> We want to be precise here,
                                    because &ldquo;we delete your messages&rdquo; is easy to say and usually
                                    only half true:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 mt-4 text-muted-foreground">
                                    <li>Chat history used for AI context is deleted automatically after 7 days.</li>
                                    <li>Voice audio is deleted immediately after transcription.</li>
                                    <li>
                                        The original text of a logged transaction is kept for as long as that
                                        transaction exists, because it is stored with the entry. Deleting an
                                        entry in the app hides it from your views; it is retained in the
                                        database until your account is deleted.
                                    </li>
                                    <li>
                                        Parse logs — original text plus how the AI interpreted it — are retained
                                        while your account is active.
                                    </li>
                                    <li>
                                        Everything is deleted when you ask us to delete your account.
                                    </li>
                                </ul>
                            </Section>

                            {/* Cookies */}
                            <Section id="cookies" title="Cookies & Tracking" delay={0.5}>
                                <p>
                                    The Blipko web dashboard uses session cookies for authentication (via NextAuth)
                                    and Vercel Analytics for anonymous page-view tracking. We do not use
                                    third-party advertising cookies.
                                </p>
                                <p className="mt-4">
                                    You can instruct your browser to refuse all cookies or to indicate when a
                                    cookie is being sent. However, refusing session cookies will prevent you from
                                    logging in to the dashboard.
                                </p>
                            </Section>

                            {/* India DPDP Act 2023 */}
                            <Section id="dpdp" title="India DPDP Act 2023" delay={0.6}>
                                <p>
                                    Blipko is operated from India and built to follow the Digital Personal Data
                                    Protection Act, 2023 (DPDP Act).
                                </p>
                                <ul className="list-disc pl-6 space-y-2 mt-4 text-muted-foreground">
                                    <li><strong>Data Fiduciary:</strong> Blipko (Sadik KP), Kerala, India.</li>
                                    <li><strong>Grievance Officer:</strong> Sadik KP — <a href="mailto:sadik.build@gmail.com" className="text-primary underline">sadik.build@gmail.com</a></li>
                                    <li><strong>Grievance Redressal:</strong> Blipko is run by one person. We aim to acknowledge grievances within a few working days and resolve them within 30 days.</li>
                                    <li><strong>Purpose Limitation:</strong> We collect data only for the purposes stated in this policy, and do not use it for anything else without your consent.</li>
                                    <li><strong>Age:</strong> Blipko is for adults. We do not knowingly collect data from anyone under 18. If you believe a minor has an account, tell us and we will delete it.</li>
                                    <li><strong>Breaches:</strong> If your personal data is exposed in a security incident, we will notify you and the Data Protection Board without undue delay once we understand what happened.</li>
                                    <li><strong>Changes:</strong> If this policy changes materially, we will update the date above and note it in the <Link href="/changelog" className="text-primary underline">changelog</Link>.</li>
                                </ul>
                            </Section>

                            {/* Your Rights */}
                            <Section id="rights" title="Your Rights" delay={0.7}>
                                <p>
                                    Under applicable law including the India DPDP Act 2023, you have the following
                                    rights regarding your personal data:
                                </p>
                                <ul className="space-y-3 mt-6">
                                    {[
                                        "The right to access the personal data we hold about you.",
                                        "The right to correct inaccurate or incomplete data.",
                                        "The right to erasure — request deletion of your account and all associated data.",
                                        "The right to data portability — receive your transaction data in a structured format.",
                                        "The right to withdraw consent at any time, by unlinking Telegram or asking us to delete your account.",
                                        "The right to grievance redressal.",
                                        "The right to object to processing for specific purposes.",
                                    ].map((right, index) => (
                                        <li key={index} className="flex items-start gap-3">
                                            <div className="mt-1 min-w-4 w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-primary" />
                                            </div>
                                            <span className="text-muted-foreground">{right}</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="mt-6">
                                    <strong>How to exercise them.</strong> Some of this you can do yourself
                                    today: edit or delete any transaction from the dashboard or the bot, change
                                    your income and budget settings under Account, unlink Telegram at any time,
                                    and export your expenses, income or a box ledger as CSV.
                                </p>
                                <p className="mt-4">
                                    For anything else — a full copy of everything we hold, or deleting your
                                    account entirely — email{" "}
                                    <a href="mailto:sadik.build@gmail.com" className="text-primary underline">
                                        sadik.build@gmail.com
                                    </a>{" "}
                                    and we will action it within 30 days. We would rather tell you plainly that
                                    these two are handled by hand right now than imply there is a button for
                                    them. Self-serve export and deletion are on the roadmap.
                                </p>
                            </Section>
                        </div>
                    </main>

                    {/* Sidebar Navigation */}
                    <aside className="hidden lg:block">
                        <div className="sticky top-32">
                            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider text-muted-foreground">
                                On this page
                            </h3>
                            <nav className="space-y-1 border-l">
                                {sections.map((section) => (
                                    <button
                                        key={section.id}
                                        onClick={() => {
                                            document.getElementById(section.id)?.scrollIntoView({ behavior: "smooth" });
                                        }}
                                        className={`w-full text-left px-4 py-2 text-sm transition-all duration-200 border-l-2 -ml-0.5 hover:text-primary flex items-center gap-2 ${activeSection === section.id
                                            ? "border-primary text-primary font-medium"
                                            : "border-transparent text-muted-foreground hover:border-gray-300"
                                            }`}
                                    >
                                        <section.icon className="w-4 h-4" />
                                        {section.title}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}

function Section({ id, title, children, delay }: { id: string; title: string; children: React.ReactNode; delay: number }) {
    return (
        <motion.section
            id={id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.5, delay }}
            className="scroll-mt-32"
        >
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                {title}
            </h2>
            <div className="text-muted-foreground leading-7 text-lg">
                {children}
            </div>
        </motion.section>
    );
}

function Card({ title, description }: { title: string; description: string }) {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="p-6 rounded-xl bg-card border shadow-sm hover:shadow-md transition-all duration-300"
        >
            <h3 className="font-semibold text-foreground mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
        </motion.div>
    );
}
