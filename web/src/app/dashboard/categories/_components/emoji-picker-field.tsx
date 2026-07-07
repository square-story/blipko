"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  EmojiPicker,
  EmojiPickerSearch,
  EmojiPickerContent,
  EmojiPickerFooter,
} from "@/components/ui/emoji-picker";
import { cn } from "@/lib/utils";

interface EmojiPickerFieldProps {
  value: string;
  onChange: (emoji: string) => void;
  className?: string;
}

export function EmojiPickerField({
  value,
  onChange,
  className,
}: EmojiPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Pick an emoji"
          className={cn("size-10 shrink-0 text-xl", className)}
        >
          {/* Pop the glyph when the emoji changes (e.g. auto-suggest or pick). */}
          <motion.span
            key={value}
            initial={reduce ? false : { scale: 0.5, opacity: 0 }}
            animate={reduce ? {} : { scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 22 }}
          >
            {value}
          </motion.span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto max-w-[calc(100vw-1rem)] p-0"
        align="start"
        collisionPadding={8}
      >
        <EmojiPicker
          className="h-[360px]"
          onEmojiSelect={({ emoji }) => {
            onChange(emoji);
            setOpen(false);
          }}
        >
          <EmojiPickerSearch autoFocus />
          <EmojiPickerContent />
          <EmojiPickerFooter />
        </EmojiPicker>
      </PopoverContent>
    </Popover>
  );
}
