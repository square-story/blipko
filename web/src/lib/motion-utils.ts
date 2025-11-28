import { motion } from "motion/react";
import type React from "react";

export type MotionHTMLElement = React.ComponentType<Record<string, unknown>>;

export const motionElements = motion as unknown as Record<
  string,
  MotionHTMLElement
>;
