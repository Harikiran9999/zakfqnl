import { motion } from "framer-motion"
import { Rocket } from "lucide-react"
import { hoverLift, spring } from "~lib/animations"
import type { Workspace } from "~lib/types"

export function WorkspaceRow({ ws, onDeploy }: { ws: Workspace; onDeploy: (ws: Workspace) => void }) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
      whileHover={hoverLift}
      transition={spring}
      className="flex items-center justify-between px-3 py-2.5 rounded-[12px] bg-white border border-black/[0.06] group"
      data-testid="workspace-row">
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{ws.name}</p>
        <p className="text-[11px] text-[#9ca3af]">{ws.memory_count} memories</p>
      </div>
      <button
        onClick={() => onDeploy(ws)}
        title="Deploy relevant memory"
        data-testid="deploy-workspace-btn"
        className="p-2 rounded-lg text-accent hover:bg-[rgba(79,70,229,0.12)] transition-colors">
        <Rocket className="w-4 h-4" />
      </button>
    </motion.div>
  )
}
