import { MessageCircle, Mic, PieChart, Activity, Bell, LayoutDashboard } from 'lucide-react'
import { motion } from 'motion/react'

const features = [
    {
        icon: MessageCircle,
        title: "Chat in Your Language",
        body: "Type \"lunch 220\" or \"auto 60\" in Malayalam, Manglish, or English. Blipko reads it and logs the spend.",
    },
    {
        icon: Mic,
        title: "Voice Notes Too",
        body: "Send a voice note on the go. It's transcribed instantly and added to your budget — no typing needed.",
    },
    {
        icon: PieChart,
        title: "Auto 50/30/20 Sorting",
        body: "Every spend is auto-categorized into Needs, Wants, or Savings. No manual tagging, ever.",
    },
    {
        icon: Activity,
        title: "Instant Budget Health",
        body: "Send /status anytime to see how much is left in each bucket and your safe daily spend.",
    },
    {
        icon: Bell,
        title: "Heads-up Before You Overspend",
        body: "Blipko nudges you when a bucket hits 80% — so the month doesn't end with a surprise.",
    },
    {
        icon: LayoutDashboard,
        title: "Monthly Report + Web Dashboard",
        body: "Get a /report each month, and dive into trends, categories, and history on the web — no app install.",
    },
];

export default function Features() {
    return (
        <section id="features" className="py-12 md:py-20 scroll-mt-20">
            <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-16">
                <motion.div 
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="relative z-10 mx-auto max-w-xl text-center"
                >
                    <h2 className="text-3xl md:text-4xl font-bold mb-3">Everything you need</h2>
                    <p className="text-muted-foreground text-lg">Budgeting that fits in a chat. Built for Kerala.</p>
                </motion.div>

                <div className="relative mx-auto grid max-w-5xl overflow-hidden rounded-xl border bg-card/60 backdrop-blur-sm sm:grid-cols-2 lg:grid-cols-3">
                    {features.map((f, i) => {
                        const Icon = f.icon;
                        return (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: i * 0.08 }}
                                className="group relative border-b border-r p-8 last:border-b-0 sm:last:border-r-0 lg:last:border-r lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-last-child(-n+3)]:border-b-0 hover:bg-muted/50 transition-colors"
                            >
                                <div className="space-y-3 relative z-10">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-background">
                                            <Icon className="h-5 w-5" />
                                        </div>
                                        <h3 className="text-base font-semibold">{f.title}</h3>
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </section>
    )
}
