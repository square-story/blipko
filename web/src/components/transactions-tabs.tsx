"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/expenses", label: "Expenses" },
  { href: "/dashboard/income", label: "Income" },
];

// Route-based tabs for the Transactions area (Expenses | Income). Each tab is
// its own route so each table paginates/filters its own model server-side.
export function TransactionsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
