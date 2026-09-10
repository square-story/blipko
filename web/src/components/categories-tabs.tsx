"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard/categories", label: "Spending" },
  { href: "/dashboard/categories/income", label: "Income" },
];

// Route-based tabs for the Categories area (Spending | Income), mirroring
// TransactionsTabs. Each is its own route so the income view can stay a server
// component while the spending page remains client-side.
export function CategoriesTabs() {
  const pathname = usePathname();
  return (
    <div className="flex gap-1 border-b">
      {TABS.map((tab) => {
        // Exact match, not startsWith: the income route is nested under the
        // spending one, which would otherwise light up both tabs.
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
