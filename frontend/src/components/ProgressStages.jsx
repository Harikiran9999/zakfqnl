import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";

const STAGES = ["Understanding", "Organizing", "Compressing", "Memory Ready"];

export default function ProgressStages({ done }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (done) { setIndex(STAGES.length - 1); return; }
    const t = setInterval(() => setIndex((i) => Math.min(i + 1, STAGES.length - 2)), 700);
    return () => clearInterval(t);
  }, [done]);

  const current = done ? STAGES.length - 1 : index;

  return (
    <div className="flex items-center gap-3" data-testid="progress-stages">
      <AnimatePresence mode="wait">
        <motion.span key={current}
          initial={{ opacity: 0, scale: 0.96, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -4 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="text-sm font-medium text-[var(--ink)] tracking-tight">
          {STAGES[current]}{current < STAGES.length - 1 ? "…" : ""}
        </motion.span>
      </AnimatePresence>
      {current === STAGES.length - 1 ? (
        <span className="w-5 h-5 rounded-full bg-[var(--success)] flex items-center justify-center">
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        </span>
      ) : (
        <span className="w-2 h-2 rounded-full bg-[var(--accent)] memory-glow" />
      )}
    </div>
  );
}
