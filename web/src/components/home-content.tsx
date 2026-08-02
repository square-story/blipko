'use client';

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { Session } from "next-auth";
import { AvatarGroup } from "@/components/animate-ui/primitives/animate/avatar-group";
import { signInWithGoogle } from "@/actions/auth";
import { formatDate } from "@/lib/format";
import { MetalFx } from "metal-fx";
import Image from "next/image";

// Below this, the real number reads worse than saying nothing, so the whole
// cluster is hidden. Avatars are generated art seeded by index — deliberately
// not real users' profile photos, which we have no consent to publish.
const SOCIAL_PROOF_MIN_USERS = 25;
const AVATAR_SEEDS = ["ledger", "rupee", "budget", "payday"];

interface HomeContentProps {
  session: Session | null;
  latestChangelog: { slug: string; date: string } | null;
  userCount: number;
}

export const HomeContent = ({ session, latestChangelog, userCount }: HomeContentProps) => {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      {/* Background glow effects */}
      <div className="fixed inset-0 pointer-events-none -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-green-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/5 blur-[120px] rounded-full" />
      </div>

      <div className="px-8 py-24 mx-auto max-w-7xl md:px-12 lg:px-20 relative z-10">
        <div>
          <p className="text-xs relative font-semibold uppercase tracking-wide text-muted-foreground">
            Blipko for Telegram is here
            <Link href="/changelog" className="relative text-foreground ml-2 hover:underline">
              <span className="absolute inset-0" aria-hidden="true"></span> See what’s new
              {/* timeZone UTC: a bare YYYY-MM-DD is UTC midnight, so local
                  formatting would show the previous day west of UTC.
                  year: undefined drops the year — the eyebrow is tight. */}
              {latestChangelog &&
                ` · ${formatDate(latestChangelog.date, {
                  timeZone: "UTC",
                  month: "short",
                  day: "numeric",
                  year: undefined,
                })}`}
            </Link>
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl mt-8 font-bold tracking-tight text-foreground lg:text-balance leading-tight">
            Powerful tracking,<br />zero hassle.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            Text your spending to a Telegram bot in Malayalam, Manglish, Hindi or English — or just send a voice note. Blipko sorts every rupee into a 50/30/20 budget and tells you what&apos;s left before you overspend.
          </p>
          <div className="flex flex-wrap mt-8 sm:items-center gap-6">
            {session?.user ? (
              <MetalFx preset="chromatic" strength={1} >
                <Link
                  href="/dashboard"
                  className="relative flex items-center justify-center text-center font-medium transition-colors duration-200 ease-in-out select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:z-10 rounded-md bg-primary hover:bg-primary/90 h-11 px-6 text-sm shadow"
                >
                  Open Dashboard
                </Link>
              </MetalFx>
            ) : (
              <form action={signInWithGoogle}>
                <MetalFx preset="chromatic" strength={1} >
                  <button
                    type="submit"
                    className="relative flex items-center justify-center gap-2 text-center font-medium transition-colors duration-200 ease-in-out select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:z-10 rounded-md bg-primary hover:bg-primary/90 h-11 px-6 text-sm shadow"
                  >
                    Get Started
                  </button>
                </MetalFx>
              </form>
            )}

            {userCount >= SOCIAL_PROOF_MIN_USERS && (
              <div className="flex flex-wrap items-center gap-3">
                <AvatarGroup className="-space-x-3">
                  {AVATAR_SEEDS.map((seed) => (
                    <Image
                      key={seed}
                      src={`https://api.dicebear.com/10.x/glass/svg?seed=${seed}`}
                      alt=""
                      aria-hidden="true"
                      className="inline-block object-cover object-center bg-muted rounded-full size-10 outline-2 outline-border border-2 border-background shadow-sm"
                      width={40}
                      height={40}
                    />
                  ))}
                </AvatarGroup>
                <div className="text-xs text-muted-foreground lg:items-center pl-2">
                  <span className="block">
                    Trusted by {userCount.toLocaleString("en-IN")} people
                  </span>
                  <span className="block">tracking their spending</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto mt-16 relative">
          <div className="absolute -inset-1 rounded-xl bg-linear-to-r from-primary to-blue-600 opacity-20 blur-xl"></div>
          <Image
            src="/screenshot03.png"
            loading="eager"
            decoding="async"
            alt="Blipko Dashboard"
            className="relative object-cover h-full rounded-xl shadow-2xl outline outline-border w-full border"
            width={1200}
            height={800}
          />
        </div>

        {/* id lives on the section, not the first card — /#features anchors here */}
        <section id="features" className="scroll-mt-24">
          <div className="mt-20 gap-x-6 gap-y-14 lg:gap-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {PILLARS.map((pillar) => (
              <div key={pillar.title} className="flex flex-col justify-between h-full">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {pillar.title}
                  </h3>
                  <p className="text-sm mt-3 text-muted-foreground leading-relaxed">
                    {pillar.body}
                  </p>
                </div>
                <ul role="list" className="mt-8 font-medium space-y-3 text-muted-foreground">
                  {pillar.bullets.map((bullet) => (
                    <li key={bullet}>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="size-5 text-primary shrink-0" />
                        <span className="text-sm">{bullet}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-28 space-y-24">
            {FEATURES.map((feature, idx) => (
              <div
                key={feature.title}
                className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16"
              >
                <div className={idx % 2 === 1 ? "lg:order-2" : undefined}>
                  <h3 className="text-2xl font-semibold tracking-tight text-foreground text-balance">
                    {feature.title}
                  </h3>
                  <p className="mt-4 text-muted-foreground leading-relaxed">
                    {feature.body}
                  </p>
                </div>
                <div className={idx % 2 === 1 ? "lg:order-1" : undefined}>
                  <Image
                    src={feature.image}
                    alt={feature.alt}
                    width={1200}
                    height={800}
                    sizes="(min-width: 1024px) 36rem, 100vw"
                    className="w-full h-auto rounded-xl border shadow-lg"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

const PILLARS = [
  {
    title: "Just say it",
    body:
      "Send \"chai 30\" and it's logged. Type or speak in English, Hindi, Manglish or Malayalam — code-mixed is fine, because that's how people actually write.",
    bullets: ["Text or voice notes", "Several spends in one message"],
  },
  {
    title: "A budget that fits real life",
    body:
      "Every spend lands in Needs, Wants or Savings, and the cycle follows your payday instead of resetting on the 1st. Rent and subscriptions post themselves.",
    bullets: ["50/30/20, fully adjustable", "Recurring bills and income"],
  },
  {
    title: "See the whole picture",
    body:
      "The dashboard stays in sync with your chat. Filter your history, watch each category, and set money aside for goals you're actually saving towards.",
    bullets: ["Analytics and CSV export", "Savings boxes with a ledger"],
  },
] as const;

const FEATURES = [
  {
    title: "Ask, and it answers",
    body:
      "Send /status for what's left in each bucket and your safe daily spend, or /report for the cycle summary. Blipko can nudge you when a bucket crosses 80% — opt-in, and you pick the volume, from gentle to relentless.",
    image: "/blipko.telegram.commands.png",
    alt: "Blipko replying to bot commands inside a Telegram chat",
  },
  {
    title: "Budgets per category, not just per bucket",
    body:
      "Wants covers both your coffee habit and your gym membership. Split it up, pin the budgets you don't want touched, and let Blipko suggest the rest from how you've actually been spending.",
    image: "/blipko.dashboard.category.section.png",
    alt: "Per-category budgets with spend pacing on the Blipko dashboard",
  },
  {
    title: "Rent shouldn't need retyping",
    body:
      "Set a bill once and it posts on its due date every month, income included. Your budget window runs payday to payday, so a salary on the 25th doesn't get split across two months.",
    image: "/blipko.recurring.overview.png",
    alt: "Recurring bills and income listed on the Blipko dashboard",
  },
  {
    title: "Know what's coming in, not just going out",
    body:
      "Income is tracked alongside spending, so the budget reflects what you actually earned this cycle rather than an assumption. See income against spend and your net at a glance.",
    image: "/blipko.income.analytics.png",
    alt: "Income versus spending analytics on the Blipko dashboard",
  },
] as const;
