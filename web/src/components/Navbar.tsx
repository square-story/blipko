"use client";
import { cn } from "@/lib/utils";
import Link from "next/link";
import React from "react";
import { Button } from "./ui/button";

export const Header = () => {
  const [isScrolled, setIsScrolled] = React.useState(false);


  React.useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  return (
    <header>
      <nav className="fixed left-0 w-full z-20 px-2">
        <div
          className={cn(
            "mx-auto mt-2 w-full max-w-6xl px-4 transition-all duration-300 sm:px-6 lg:px-12",
            isScrolled &&
            "bg-background/50 max-w-4xl rounded-2xl border backdrop-blur-lg lg:px-5"
          )}
        >
          <div className="relative flex flex-wrap items-center justify-between gap-2 py-2 sm:flex-nowrap">
            <Link
              href="/"
              aria-label="home"
              className="flex gap-2 items-center"
            >
              <p className="font-semibold text-xl tracking-tighter italic">
                Blipko
              </p>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                href="/#features"
                className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 transition-colors"
              >
                Features
              </Link>
              <Link
                href="/#faq"
                className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 transition-colors"
              >
                FAQ
              </Link>
              <Link
                href="/privacy-policy"
                className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground px-3 py-1.5 transition-colors"
              >
                Privacy
              </Link>
              <Button className="rounded-full" size="sm">
                <Link href="/terms">Terms</Link>
              </Button>
            </div>
          </div>
        </div>
      </nav>
    </header >
  );
};
