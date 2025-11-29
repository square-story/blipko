"use client";

import { DIcons } from "dicons";
import Link from "next/link";
import ThemeToogle from "@/components/ui/theme-toogle";



const Underline = `hover:-translate-y-1 border border-dotted rounded-xl p-2.5 transition-transform `;

export function Footer() {
  return (
    <footer className="border-ali/20 px-4 mx-auto w-full border-b border-t">
      <div className="relative mx-auto w-full items-center flex justify-center gap-6 p-10 pb-0 pt-10">
        <Link href="/" aria-label="home" className="flex gap-2 items-center">
          <p className="font-semibold text-xl tracking-tighter italic">Blipko</p>
        </Link>
      </div>

      <div className="flex items-center justify-center gap-6 py-6">
        <Link
          aria-label="GitHub"
          href="https://github.com/square-story/blipko"
          rel="noreferrer"
          target="_blank"
          className={Underline}
        >
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path
              fillRule="evenodd"
              d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
        <Link
          aria-label="LinkedIn"
          href="https://linkedin.com/in/sadikkp"
          rel="noreferrer"
          target="_blank"
          className={Underline}
        >
          <DIcons.LinkedIn className="h-5 w-5" />
        </Link>
        <Link
          aria-label="Email"
          href="mailto:gibmepreo@gmail.com"
          rel="noreferrer"
          target="_blank"
          className={Underline}
        >
          <DIcons.Mail strokeWidth={1.5} className="h-5 w-5" />
        </Link>
        <ThemeToogle />
      </div>

      <div className="mx-auto mb-8 flex flex-col justify-center text-center text-sm">
        <div className="flex flex-row items-center justify-center gap-2 text-slate-600 dark:text-slate-400 font-bangla">
          <span>© {new Date().getFullYear()}</span>
          <span className="cursor-pointer text-black dark:text-white font-semibold">
            <Link aria-label="Blipko" href="/">
              Blipko
            </Link>
          </span>
          <span>·</span>
          <span>Built By</span>
          <Link
            aria-label="sadik"
            href="https://sadik.is-a.dev"
            target="_blank"
            className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer text-black dark:text-white font-semibold"
          >
            Sadik
          </Link>
        </div>
      </div>
    </footer>
  );
}
