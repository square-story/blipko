"use client";

import { motion, useScroll, useSpring } from "motion/react";
import { ArrowRight, FileText, Scale, Shield, User } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";

const sections = [
    { id: "acceptance", title: "Acceptance of Terms", icon: FileText },
    { id: "service", title: "Description of Service", icon: User },
    { id: "acceptable-use", title: "Acceptable Use", icon: Shield },
    { id: "data-privacy", title: "Data & Privacy", icon: Shield },
    { id: "disclaimer", title: "Disclaimer of Warranties", icon: Scale },
    { id: "liability", title: "Limitation of Liability", icon: Scale },
    { id: "governing-law", title: "Governing Law", icon: ArrowRight },
    { id: "contact", title: "Contact", icon: ArrowRight },
];

export default function TermsPage() {
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
            <motion.div
                className="fixed top-0 left-0 right-0 h-1 bg-primary origin-left z-50"
                style={{ scaleX }}
            />


            <div className="container mx-auto px-4 py-20 lg:py-32 relative z-10">
                <div className="grid lg:grid-cols-[1fr_300px] gap-12">

                    <main>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="mb-16"
                        >
                            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-linear-to-r from-primary to-blue-600 mb-6">
                                Terms of Service
                            </h1>
                            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
                                By using Blipko you agree to these terms. Please read them carefully.
                                Blipko is currently in early access — features may change as the service evolves.
                            </p>
                            <div className="mt-8 text-sm text-muted-foreground">
                                Last updated: May 16, 2026
                            </div>
                        </motion.div>

                        <div className="space-y-24">
                            <Section id="acceptance" title="Acceptance of Terms" delay={0.1}>
                                <p>
                                    By accessing or using Blipko (the &ldquo;Service&rdquo;), including the Telegram bot and
                                    web dashboard at blipko.app, you agree to be bound by these Terms of Service.
                                    If you do not agree, do not use the Service.
                                </p>
                                <p className="mt-4">
                                    We may update these terms from time to time. Continued use of the Service after
                                    changes are posted constitutes acceptance of the revised terms.
                                </p>
                            </Section>

                            <Section id="service" title="Description of Service" delay={0.2}>
                                <p>
                                    Blipko is an AI-powered expense tracking service delivered via a Telegram bot
                                    and a web dashboard. Core capabilities include:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 mt-4 text-muted-foreground">
                                    <li>Natural language expense logging in Malayalam, Manglish, Hindi, and English.</li>
                                    <li>Voice-note transcription for hands-free entry using Sarvam AI.</li>
                                    <li>Recurring dues management with automated Telegram reminders.</li>
                                    <li>Multi-wallet support (Personal, Business, Savings, and custom wallets).</li>
                                    <li>Family group expense tracking with invite-code-based membership.</li>
                                    <li>Web dashboard with analytics, vendor management, and transaction history.</li>
                                </ul>
                                <p className="mt-4">
                                    The Service is provided &ldquo;as is&rdquo; during early access. Features listed on this page
                                    reflect what is currently live. Roadmap items are not guaranteed.
                                </p>
                            </Section>

                            <Section id="acceptable-use" title="Acceptable Use" delay={0.3}>
                                <p>You agree not to use Blipko to:</p>
                                <ul className="list-disc pl-6 space-y-2 mt-4 text-muted-foreground">
                                    <li>Record or track transactions related to illegal activities.</li>
                                    <li>Attempt to reverse-engineer, scrape, or abuse the bot or API.</li>
                                    <li>Impersonate another person or provide false information.</li>
                                    <li>Transmit spam, malware, or harmful content via the Telegram bot.</li>
                                    <li>Circumvent any rate limits, security controls, or access restrictions.</li>
                                </ul>
                                <p className="mt-4">
                                    We reserve the right to suspend or terminate accounts that violate these rules
                                    without prior notice.
                                </p>
                            </Section>

                            <Section id="data-privacy" title="Data & Privacy" delay={0.4}>
                                <p>
                                    Your privacy matters to us. Our{" "}
                                    <Link href="/privacy-policy" className="text-primary underline">
                                        Privacy Policy
                                    </Link>{" "}
                                    explains what data we collect, how we use it, and your rights under the
                                    India Digital Personal Data Protection Act 2023 (DPDP Act).
                                </p>
                                <p className="mt-4">
                                    By using Blipko you consent to the collection and processing of your data
                                    as described in the Privacy Policy. Your messages may be processed by
                                    third-party AI services (Google Gemini, OpenAI, Sarvam AI) solely to
                                    power the Service.
                                </p>
                            </Section>

                            <Section id="disclaimer" title="Disclaimer of Warranties" delay={0.5}>
                                <p>
                                    Blipko is provided on an <strong>&ldquo;as is&rdquo; and &ldquo;as available&rdquo;</strong> basis
                                    without warranties of any kind, express or implied. We do not warrant that:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 mt-4 text-muted-foreground">
                                    <li>The Service will be uninterrupted, error-free, or secure at all times.</li>
                                    <li>AI-parsed transaction data will be 100% accurate — always verify important entries.</li>
                                    <li>The Service will be free of bugs, viruses, or other harmful components.</li>
                                </ul>
                                <p className="mt-4">
                                    Blipko is a personal finance <em>assistant</em>, not a licensed financial advisor.
                                    Do not rely solely on Blipko for business-critical financial decisions.
                                </p>
                            </Section>

                            <Section id="liability" title="Limitation of Liability" delay={0.6}>
                                <p>
                                    To the maximum extent permitted by applicable law, Blipko and its operator
                                    (Sadik KP) shall not be liable for any indirect, incidental, special,
                                    consequential, or punitive damages arising from your use of or inability
                                    to use the Service.
                                </p>
                                <p className="mt-4">
                                    Our total liability to you for any claim arising out of or relating to
                                    these terms or the Service shall not exceed the amount you paid us in the
                                    12 months preceding the claim (if any).
                                </p>
                            </Section>

                            <Section id="governing-law" title="Governing Law" delay={0.7}>
                                <p>
                                    These Terms are governed by and construed in accordance with the laws of
                                    India. Any disputes arising from these terms or your use of the Service
                                    shall be subject to the exclusive jurisdiction of the courts in Kerala, India.
                                </p>
                                <p className="mt-4">
                                    If any provision of these terms is found to be unenforceable, the remaining
                                    provisions will continue in full force and effect.
                                </p>
                            </Section>

                            <Section id="contact" title="Contact" delay={0.8}>
                                <p>
                                    Questions about these Terms? Contact us at{" "}
                                    <a href="mailto:sadik.build@gmail.com" className="text-primary underline">
                                        sadik.build@gmail.com
                                    </a>.
                                </p>
                                <p className="mt-4">
                                    For privacy-related requests, see our{" "}
                                    <Link href="/privacy-policy" className="text-primary underline">
                                        Privacy Policy
                                    </Link>{" "}
                                    — grievances are acknowledged within 48 hours and resolved within 30 days.
                                </p>
                            </Section>
                        </div>
                    </main>

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
