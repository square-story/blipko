"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Fallback if the runtime lacks Intl.supportedValuesOf (older engines).
const FALLBACK_ZONES = [
  "Asia/Kolkata",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "America/Chicago",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function listZones(): string[] {
  try {
    const fn = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf;
    const zones = fn?.("timeZone");
    if (zones && zones.length) return zones;
  } catch {
    /* fall through to the curated list */
  }
  return FALLBACK_ZONES;
}

// e.g. "GMT+5:30" for the given zone right now.
function offsetLabel(zone: string): string {
  try {
    return (
      new Intl.DateTimeFormat("en-US", {
        timeZone: zone,
        timeZoneName: "shortOffset",
      })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? ""
    );
  } catch {
    return "";
  }
}

// Searchable single-select combobox over the IANA timezone list (shadcn Combobox
// = Popover + Command). Value is the IANA id (e.g. "Asia/Kolkata").
export function TimezoneSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (tz: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const options = useMemo(
    () => listZones().map((zone) => ({ zone, offset: offsetLabel(zone) })),
    [],
  );
  const currentOffset = useMemo(() => offsetLabel(value), [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {value}
            {currentOffset && (
              <span className="ml-2 text-muted-foreground">{currentOffset}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search timezone…" />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {options.map(({ zone, offset }) => (
                <CommandItem
                  key={zone}
                  value={zone}
                  // Use the closured zone (cmdk lowercases the onSelect arg).
                  onSelect={() => {
                    onChange(zone);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      zone === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{zone}</span>
                  <span className="ml-auto pl-2 text-xs text-muted-foreground">
                    {offset}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
