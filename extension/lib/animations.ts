// Framer Motion presets — quiet, confident, spring-driven. 180ms feel.

import type { Transition, Variants } from "framer-motion"

export const spring: Transition = { type: "spring", stiffness: 240, damping: 24 }
export const softSpring: Transition = { type: "spring", stiffness: 160, damping: 22 }

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: spring }
}

export const fadeRise: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: softSpring }
}

export const listStagger: Variants = {
  show: { transition: { staggerChildren: 0.04 } }
}

export const hoverLift = { scale: 1.02 }
export const tapPress = { scale: 0.98 }
