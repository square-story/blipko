'use client';

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { Session } from "next-auth";
import { AvatarGroup, AvatarGroupTooltip, AvatarGroupTooltipArrow } from "@/components/animate-ui/primitives/animate/avatar-group";
import { signInWithGoogle } from "@/actions/auth";
import { MetalFx } from "metal-fx";
import Image from "next/image";

interface HomeContentProps {
  session: Session | null;
}

export const HomeContent = ({ session }: HomeContentProps) => {
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
            <a href="#_" className="relative text-foreground ml-2 hover:underline">
              <span className="absolute inset-0" aria-hidden="true"></span> See what’s new
            </a>
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl mt-8 font-bold tracking-tight text-foreground lg:text-balance leading-tight">
            Powerful tracking,<br />zero hassle.
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
            Log any spend in plain Malayalam, Manglish, or English — by text or voice. Blipko categorizes it instantly using the 50/30/20 rule.
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

            <div className="flex flex-wrap items-center gap-3">
              <AvatarGroup className="-space-x-3">
                {[
                  { seed: "Felix", name: "Felix" },
                  { seed: "Aneka", name: "Aneka" },
                  { seed: "Jack", name: "Jack" },
                  { seed: "Jude", name: "Jude" },
                ].map((avatar, idx) => (
                  <div key={idx} className="relative">
                    <Image
                      src={`https://api.dicebear.com/10.x/glass/svg?seed=${avatar.seed}`}
                      alt={avatar.name}
                      className="inline-block object-cover object-center bg-muted rounded-full size-10 outline-2 outline-border border-2 border-background shadow-sm"
                      width={40}
                      height={40}
                    />
                    <AvatarGroupTooltip>
                      <AvatarGroupTooltipArrow />
                      <p className="text-sm">{avatar.name}</p>
                    </AvatarGroupTooltip>
                  </div>
                ))}
              </AvatarGroup>
              <div className="text-xs text-muted-foreground lg:items-center pl-2">
                <span className="block">Trusted by users</span>
                <span className="block">who value simplicity</span>
              </div>
            </div>
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

        <div className="mt-20 gap-x-6 gap-y-14 lg:gap-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex flex-col justify-between h-full" id="features">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Works out of the box
              </h3>
              <p className="text-sm mt-3 text-muted-foreground leading-relaxed">
                No apps to install, no new logins. Just open your Telegram chat and start typing. Blipko is instantly ready.
              </p>
            </div>
            <ul role="list" className="mt-8 font-medium space-y-3 text-muted-foreground">
              <li>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-primary" />
                  <span className="text-sm"> Zero configuration hero </span>
                </div>
              </li>
              <li>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-primary" />
                  <span className="text-sm"> Launch before lunch </span>
                </div>
              </li>
            </ul>
          </div>

          <div className="flex flex-col justify-between h-full">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Actually helpful features
              </h3>
              <p className="text-sm mt-3 text-muted-foreground leading-relaxed">
                Log any spend in plain Malayalam, Manglish, or English — by text or voice. We categorize it instantly.
              </p>
            </div>
            <ul role="list" className="mt-8 font-medium space-y-3 text-muted-foreground">
              <li>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-primary" />
                  <span className="text-sm"> Voice note parsing </span>
                </div>
              </li>
              <li>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-primary" />
                  <span className="text-sm"> 50/30/20 budgeting </span>
                </div>
              </li>
            </ul>
          </div>

          <div className="flex flex-col justify-between h-full">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Plays nice with others
              </h3>
              <p className="text-sm mt-3 text-muted-foreground leading-relaxed">
                See beautiful analytics in your dashboard, completely synced with your Telegram chat history.
              </p>
            </div>
            <ul role="list" className="mt-8 font-medium space-y-3 text-muted-foreground">
              <li>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-primary" />
                  <span className="text-sm"> Real-time sync </span>
                </div>
              </li>
              <li>
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-primary" />
                  <span className="text-sm"> Beautiful dashboard </span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
};
