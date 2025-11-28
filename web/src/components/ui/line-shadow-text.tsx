"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import type { JSX } from "react";


import { cn } from "@/lib/utils";
import { motionElements, MotionHTMLElement } from "@/lib/motion-utils";

type LineShadowElement = keyof JSX.IntrinsicElements;

interface LineShadowTextProps extends HTMLMotionProps<"span"> {
  shadowColor?: string;
  as?: LineShadowElement;
}

export function LineShadowText({
  children,
  shadowColor = "black",
  className,
  as: tag = "span",
  ...props
}: LineShadowTextProps) {
  const MotionComponent =
    motionElements[tag] ?? (motion.span as MotionHTMLElement);
  const content = typeof children === "string" ? children : null;

  if (!content) {
    throw new Error("LineShadowText only accepts string content");
  }

  // Motion's style typing does not yet understand custom CSS variables.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const style = { "--shadow-color": shadowColor } as any;

  return (
    <MotionComponent
      style={style}
      className={cn(
        "relative z-0 inline-flex",
        "after:absolute after:top-[0.04em] after:left-[0.04em] after:content-[attr(data-text)]",
        "after:bg-[linear-gradient(45deg,transparent_45%,var(--shadow-color)_45%,var(--shadow-color)_55%,transparent_0)]",
        "after:-z-10 after:bg-size-[0.06em_0.06em] after:bg-clip-text after:text-transparent",
        "after:animate-line-shadow",
        className
      )}
      data-text={content}
      {...props}
    >
      {content}
    </MotionComponent>
  );
}
