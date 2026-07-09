import { AnimatePresence, motion } from "framer-motion"
import { Check } from "lucide-react"
import { spring } from "~lib/animations"

const SUCCESS = new Set(["Memory Ready", "Deployed", "Prompt optimized"])

export function Toast({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={spring}
          data-testid="toast"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-ink text-white text-xs font-medium flex items-center gap-2 shadow-lg">
          {SUCCESS.has(message) ? (
            <Check className="w-3.5 h-3.5 text-success" strokeWidth={3} />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-accent memory-glow" />
          )}
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
