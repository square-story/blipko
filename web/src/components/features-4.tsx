import { MessageCircle, Mic, Bell, Users, Wallet, LayoutDashboard } from 'lucide-react'
import { motion } from 'motion/react'
import { Card } from '@/components/ui/card'

const features = [
    {
        icon: MessageCircle,
        title: "Chat in Your Language",
        body: "Works with Manglish, English, and Hindi. Say \"rent koduthu\" or \"salary kitti\" — Blipko understands.",
    },
    {
        icon: Mic,
        title: "Voice Notes Too",
        body: "Send a voice note in Malayalam. Sarvam AI transcribes it instantly. No typing needed.",
    },
    {
        icon: Bell,
        title: "Never Miss Rent Day",
        body: "Set recurring dues once. Get a Telegram reminder every month at 9 AM with a one-tap Mark Paid button.",
    },
    {
        icon: Users,
        title: "Family Finance Together",
        body: "Create a group with an invite code. Track who spent what — perfect for shared households and small businesses.",
    },
    {
        icon: Wallet,
        title: "Multiple Wallets",
        body: "Separate Personal, Business, and Savings. Prefix your message: \"Shop: Raju 500 koduthu\" to log to the right wallet.",
    },
    {
        icon: LayoutDashboard,
        title: "Dashboard on Web",
        body: "View analytics, manage vendors, and check recurring charges from any browser — no app install needed.",
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
                    <p className="text-muted-foreground text-lg">Built for Keralites. Works wherever you are.</p>
                </motion.div>

                <Card className="overflow-hidden">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3">
                        {features.map((f, i) => {
                            const Icon = f.icon;
                            return (
                                <div
                                    key={i}
                                    className="border-b border-r p-8 last:border-b-0 sm:last:border-r-0 lg:last:border-r lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-last-child(-n+3)]:border-b-0 hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex flex-col gap-3">
                                        <div className="flex items-center gap-3">
                                            <div className="flex size-10 items-center justify-center rounded-lg border bg-background">
                                                <Icon />
                                            </div>
                                            <h3 className="text-base font-semibold">{f.title}</h3>
                                        </div>
                                        <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </Card>
            </div>
        </section>
    )
}
