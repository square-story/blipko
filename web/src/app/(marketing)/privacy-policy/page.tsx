"use client";

import { GravityStarsBackground } from "@/components/animate-ui/components/backgrounds/gravity-stars";
import { motion, useScroll, useSpring } from "framer-motion";
import { ArrowRight, FileText, Lock, Shield, User } from "lucide-react";
import { useEffect, useState } from "react";

const sections = [
    { id: "info-collect", title: "Information We Collect", icon: FileText },
    { id: "usage", title: "How We Use Your Information", icon: User },
    { id: "protection", title: "Data Protection", icon: Shield },
    { id: "cookies", title: "Cookies & Tracking", icon: Lock },
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

            {/* Background Decor */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <GravityStarsBackground />
            </div>

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
                                Privacy & Policy
                            </h1>
                            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
                                We value your trust and are committed to protecting your personal information.
                                This policy outlines how we handle your data with transparency and care.
                            </p>
                            <div className="mt-8 text-sm text-muted-foreground">
                                Last updated: December 06, 2025
                            </div>
                        </motion.div>

                        <div className="space-y-24">
                            {/* Information We Collect */}
                            <Section id="info-collect" title="Information We Collect" delay={0.1}>
                                <p>
                                    We collect information you provide directly to us when you create an account,
                                    update your profile, or communicate with us. This may include:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 mt-4 text-muted-foreground">
                                    <li><strong>Personal Identification:</strong> Name, email address, phone number.</li>
                                    <li><strong>Account Data:</strong> Username, password, and preference settings.</li>
                                    <li><strong>Content:</strong> Any generated content or files you upload to our service.</li>
                                </ul>
                            </Section>

                            {/* How We Use Your Information */}
                            <Section id="usage" title="How We Use Your Information" delay={0.2}>
                                <p>
                                    We use the collected data to provide, maintain, and improve our services.
                                    Specific use cases include:
                                </p>
                                <div className="grid sm:grid-cols-2 gap-4 mt-6">
                                    <Card title="Service Delivery" description="To authenticate users and provide core functionality." />
                                    <Card title="Communication" description="To send updates, security alerts, and support messages." />
                                    <Card title="Improvement" description="To analyze usage patterns and optimize performance." />
                                    <Card title="Security" description="To detect and prevent fraudulent activities." />
                                </div>
                            </Section>

                            {/* Data Protection */}
                            <Section id="protection" title="Data Protection" delay={0.3}>
                                <p>
                                    Security is our top priority. We implement robust technical and organizational measures
                                    to responsible for safeguarding your personal data against unauthorized access, loss, or alteration.
                                </p>
                                <p className="mt-4">
                                    However, no method of transmission over the Internet or method of electronic storage is
                                    100% secure. While we strive to use commercially acceptable means to protect your Personal Data,
                                    we cannot guarantee its absolute security.
                                </p>
                            </Section>

                            {/* Cookies */}
                            <Section id="cookies" title="Cookies & Tracking" delay={0.4}>
                                <p>
                                    We use cookies and similar tracking technologies to track the activity on our Service
                                    and store certain information. Tracking technologies used are beacons, tags, and scripts
                                    to collect and track information and to improve and analyze our Service.
                                </p>
                                <p className="mt-4">
                                    You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
                                    However, if you do not accept cookies, you may not be able to use some parts of our Service.
                                </p>
                            </Section>

                            {/* Your Rights */}
                            <Section id="rights" title="Your Rights" delay={0.5}>
                                <p>
                                    Depending on your location, you may have the following rights regarding your personal data:
                                </p>
                                <ul className="space-y-3 mt-6">
                                    {[
                                        "The right to access, update or delete the information we have on you.",
                                        "The right of rectification.",
                                        "The right to object.",
                                        "The right of restriction.",
                                        "The right to data portability.",
                                        "The right to withdraw consent.",
                                    ].map((right, index) => (
                                        <li key={index} className="flex items-start gap-3">
                                            <div className="mt-1 min-w-4 w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center">
                                                <div className="w-2 h-2 rounded-full bg-primary" />
                                            </div>
                                            <span className="text-muted-foreground">{right}</span>
                                        </li>
                                    ))}
                                </ul>
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
                                        className={`w-full text-left px-4 py-2 text-sm transition-all duration-200 border-l-2 -ml-[2px] hover:text-primary flex items-center gap-2 ${activeSection === section.id
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
