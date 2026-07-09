import { motion } from "framer-motion"
import type { ReactNode } from "react"
import { spring, hoverLift, tapPress } from "~lib/animations"

interface Props {
  children: ReactNode
  onClick?: () => void
  variant?: "primary" | "ghost" | "soft"
  disabled?: boolean
  full?: boolean
  className?: string
}

const styles: Record<string, string> = {
  primary: "bg-ink text-white",
  ghost: "bg-transparent text-ink border border-black/10",
  soft: "bg-white text-ink border border-black/[0.06]"
}

export function Button({ children, onClick, variant = "primary", disabled, full, className = "" }: Props) {
  return (
    <motion.button
      whileHover={disabled ? undefined : hoverLift}
      whileTap={disabled ? undefined : tapPress}
      transition={spring}
      onClick={onClick}
      disabled={disabled}
      className={`h-10 px-4 rounded-full text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none ${styles[variant]} ${full ? "w-full" : ""} ${className}`}>
      {children}
    </motion.button>
  )
}
