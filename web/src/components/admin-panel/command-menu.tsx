"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
    Calculator,
    Calendar,
    CreditCard,
    Settings,
    Smile,
    User,
    LayoutGrid,
    ArrowRightLeft,
    PieChart,
    Users,
    Tags,
    Search,
} from "lucide-react";

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getMenuList } from "@/lib/menu-list";

export function CommandMenu() {
    const [open, setOpen] = React.useState(false);
    const router = useRouter();
    const menuList = getMenuList(""); // Pathname doesn't matter for list generation

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const runCommand = React.useCallback((command: () => unknown) => {
        setOpen(false);
        command();
    }, []);

    return (
        <>
            <Button
                variant="outline"
                className={cn(
                    "relative h-8 w-8 justify-center rounded-full sm:rounded-[0.5rem] bg-background text-sm font-normal text-muted-foreground shadow-none lg:w-64 lg:justify-start lg:pr-12"
                )}
                onClick={() => setOpen(true)}
            >
                <Search className="h-4 w-4 lg:hidden" />
                <span className="hidden lg:inline-flex">Search dashboard...</span>
                <span className="hidden lg:hidden">Search...</span>
                <kbd className="pointer-events-none absolute right-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 lg:flex">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </Button>
            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Type a command or search..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                    {menuList.map((group, index) => (
                        <React.Fragment key={index}>
                            <CommandGroup heading={group.groupLabel || "General"}>
                                {group.menus.map((menu, menuIndex) => (
                                    <CommandItem
                                        key={menuIndex}
                                        onSelect={() => {
                                            runCommand(() => router.push(menu.href));
                                        }}
                                    >
                                        <menu.icon className="mr-2 h-4 w-4" />
                                        <span>{menu.label}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                            {index < menuList.length - 1 && <CommandSeparator />}
                        </React.Fragment>
                    ))}
                </CommandList>
            </CommandDialog>
        </>
    );
}
