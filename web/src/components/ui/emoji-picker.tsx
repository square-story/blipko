"use client";

import * as React from "react";
import { EmojiPicker as EmojiPickerPrimitive } from "frimousse";
import { LoaderCircle, Search } from "lucide-react";

import { cn } from "@/lib/utils";

function EmojiPicker({
  className,
  ...props
}: React.ComponentProps<typeof EmojiPickerPrimitive.Root>) {
  return (
    <EmojiPickerPrimitive.Root
      data-slot="emoji-picker"
      className={cn(
        "bg-popover text-popover-foreground isolate flex h-full w-fit flex-col overflow-hidden rounded-md",
        className,
      )}
      {...props}
    />
  );
}

function EmojiPickerSearch({
  className,
  ...props
}: React.ComponentProps<typeof EmojiPickerPrimitive.Search>) {
  return (
    <div
      data-slot="emoji-picker-search-wrapper"
      className="flex items-center gap-2 border-b px-3"
    >
      <Search className="size-4 shrink-0 opacity-50" />
      <EmojiPickerPrimitive.Search
        data-slot="emoji-picker-search"
        className={cn(
          "placeholder:text-muted-foreground flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function EmojiPickerContent({
  className,
  ...props
}: React.ComponentProps<typeof EmojiPickerPrimitive.Viewport>) {
  return (
    <EmojiPickerPrimitive.Viewport
      data-slot="emoji-picker-viewport"
      className={cn("relative flex-1 min-h-0 outline-hidden", className)}
      {...props}
    >
      <EmojiPickerPrimitive.Loading className="text-muted-foreground absolute inset-0 flex items-center justify-center">
        <LoaderCircle className="size-4 animate-spin" />
      </EmojiPickerPrimitive.Loading>
      <EmojiPickerPrimitive.Empty className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
        No emoji found.
      </EmojiPickerPrimitive.Empty>
      <EmojiPickerPrimitive.List
        className="select-none pb-1"
        components={{
          CategoryHeader: ({ category, ...props }) => (
            <div
              data-slot="emoji-picker-category-header"
              className="bg-popover text-muted-foreground px-3 pt-3.5 pb-2 text-xs leading-none"
              {...props}
            >
              {category.label}
            </div>
          ),
          Row: ({ children, ...props }) => (
            <div
              data-slot="emoji-picker-row"
              className="scroll-my-1 px-1"
              {...props}
            >
              {children}
            </div>
          ),
          Emoji: ({ emoji, ...props }) => (
            <button
              data-slot="emoji-picker-emoji"
              className="data-[active]:bg-accent flex size-8 items-center justify-center rounded-sm text-lg"
              {...props}
            >
              {emoji.emoji}
            </button>
          ),
        }}
      />
    </EmojiPickerPrimitive.Viewport>
  );
}

function EmojiPickerFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="emoji-picker-footer"
      className={cn(
        "flex w-full min-w-0 items-center gap-1 border-t p-2",
        className,
      )}
      {...props}
    >
      <EmojiPickerPrimitive.ActiveEmoji>
        {({ emoji }) =>
          emoji ? (
            <>
              <div className="flex size-7 flex-none items-center justify-center text-lg">
                {emoji.emoji}
              </div>
              <span className="text-secondary-foreground truncate text-xs">
                {emoji.label}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground ml-1.5 flex h-7 items-center truncate text-xs">
              Select an emoji…
            </span>
          )
        }
      </EmojiPickerPrimitive.ActiveEmoji>
    </div>
  );
}

export { EmojiPicker, EmojiPickerSearch, EmojiPickerContent, EmojiPickerFooter };
