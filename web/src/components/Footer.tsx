"use client";
import Link from "next/link";
import ThemeToogle from "@/components/ui/theme-toogle";
import { AuthorTooltip } from "./ui/author-tooltip";
import { founderData } from "@/lib/founder-data";

export function Footer() {
  return (
    <footer className="border-ali/20 px-4 mx-auto w-full border-b border-t">
      <div className="relative mx-auto w-full items-center flex justify-center gap-6 p-10 pb-0 pt-10">
        <Link href="/" aria-label="home" className="flex gap-2 items-center">
          <p className="font-semibold text-xl tracking-tighter italic">Blipko</p>
        </Link>
        <ThemeToogle />
      </div>

      <span className="flex py-2" />
      <div className="mx-auto mb-8 flex flex-col items-center justify-center text-center text-sm gap-3">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Link href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
          <span>·</span>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
        </div>
        <div className="flex flex-row items-center justify-center gap-2 text-slate-600 dark:text-slate-400 font-bangla">
          <span>© {new Date().getFullYear()}</span>
          <span className="cursor-pointer text-black dark:text-white font-semibold">
            <Link aria-label="Blipko" href="/">
              Blipko
            </Link>
          </span>
          <span>·</span>
          <span>Built By</span>
          <AuthorTooltip author={founderData} isAvatarVisible />
        </div>
      </div>
    </footer>
  );
}
