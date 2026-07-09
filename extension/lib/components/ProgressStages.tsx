import { AnimatePresence, motion } from "framer-motion"
import { Check } from "lucide-react"
import { spring } from "~lib/animations"
import { STAGE_LABEL, type SaveStage } from "~lib/types"

export function ProgressStages({ stage }: { stage: SaveStage }) {
  if (stage === "idle") return null
  const done = stage === "ready"
  const err = stage === "error"
  return (
    <div className="flex items-center gap-2.5" data-testid="progress-stages">
      <AnimatePresence mode="wait">
        <motion.span
          key={stage}
          initial={{ opacity: 0, y: 4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={spring}
          className={`text-sm font-medium tracking-tight ${err ? "text-red-500" : "text-ink"}`}>
          {STAGE_LABEL[stage]}
          {!done && !err ? "…" : ""}
        </motion.span>
      </AnimatePresence>
      {done ? (
        <span className="w-5 h-5 rounded-full bg-success flex items-center justify-center">
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        </span>
      ) : err ? null : (
        <span className="w-2 h-2 rounded-full bg-accent memory-glow" />
      )}
    </div>
  )
}
