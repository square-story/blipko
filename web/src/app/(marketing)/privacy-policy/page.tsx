"use client";

import { motion, useScroll, useSpring } from "motion/react";
import { ArrowRight, Bot, FileText, Lock, Shield, User } from "lucide-react";
import { useEffect, useState } from "react";

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
                                Last updated: May 16, 2026
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
                                    <li><strong>Transaction Data:</strong> Financial messages, contact names, and amounts you send to the Blipko bot.</li>
                                    <li><strong>Voice Notes:</strong> Audio files you send to the bot for voice-to-text transcription.</li>
                                    <li><strong>Usage Data:</strong> IP address, browser type, and page-view data collected via Vercel Analytics.</li>
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
                                    <Card title="Improvement" description="To analyse usage patterns and improve bot accuracy and performance." />
                                    <Card title="Security" description="To detect and prevent fraudulent activities and abuse." />
                                </div>
                            </Section>

                            {/* Third-Party AI Processors */}
                            <Section id="ai-processors" title="Third-Party AI Processors" delay={0.3}>
                                <p>
                                    Blipko uses third-party AI services to power its natural language understanding and
                                    voice transcription. When you send a message or voice note to the Blipko bot,
                                    that content is processed by one or more of the following services:
                                </p>
                                <ul className="list-disc pl-6 space-y-3 mt-4 text-muted-foreground">
                                    <li>
                                        <strong>Google Gemini API</strong> — Primary AI parser for understanding
                                        your financial messages in Manglish, Malayalam, Hindi, and English.
                                    </li>
                                    <li>
                                        <strong>OpenAI API</strong> — Fallback parser used when Gemini is unavailable.
                                    </li>
                                    <li>
                                        <strong>Sarvam AI</strong> — Voice-to-text transcription optimised for
                                        Indian languages including Malayalam.
                                    </li>
                                </ul>
                                <p className="mt-4">
                                    Your messages are sent to these processors solely to power the Blipko service.
                                    We do not sell your data to any third party. Each processor is governed by
                                    their own privacy policies.
                                </p>
                            </Section>

                            {/* Data Protection */}
                            <Section id="protection" title="Data Protection" delay={0.4}>
                                <p>
                                    Security is our top priority. We implement robust technical and organisational
                                    measures responsible for safeguarding your personal data against unauthorised
                                    access, loss, or alteration.
                                </p>
                                <p className="mt-4">
                                    However, no method of transmission over the Internet or method of electronic
                                    storage is 100% secure. While we strive to use commercially acceptable means
                                    to protect your personal data, we cannot guarantee its absolute security.
                                </p>
                                <p className="mt-4">
                                    Conversation history is automatically pruned after 7 days. You may request
                                    full account deletion at any time (see Your Rights below).
                                </p>
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
                                    Blipko is operated from India and complies with the Digital Personal Data
                                    Protection Act, 2023 (DPDP Act).
                                </p>
                                <ul className="list-disc pl-6 space-y-2 mt-4 text-muted-foreground">
                                    <li><strong>Data Fiduciary:</strong> Blipko (Sadik KP), Kerala, India.</li>
                                    <li><strong>Grievance Officer:</strong> Sadik KP — <a href="mailto:sadik.build@gmail.com" className="text-primary underline">sadik.build@gmail.com</a></li>
                                    <li><strong>Grievance Redressal:</strong> We will acknowledge your grievance within 48 hours and resolve it within 30 days.</li>
                                    <li><strong>Data Retention:</strong> Transaction data is retained as long as your account is active. Upon account deletion request, your personal data will be deleted within 30 days.</li>
                                    <li><strong>Purpose Limitation:</strong> We collect data only for the purposes stated in this policy and do not use it for any other purpose without your consent.</li>
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
                                        "The right to withdraw consent at any time.",
                                        "The right to grievance redressal within 30 days.",
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
                                    To exercise any of these rights, contact us at{" "}
                                    <a href="mailto:sadik.build@gmail.com" className="text-primary underline">
                                        sadik.build@gmail.com
                                    </a>.
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
