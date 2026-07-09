import { useState } from "react"
import { motion } from "framer-motion"
import { Sparkles, Save, FolderPlus, Loader2, LogOut } from "lucide-react"
import "~style.css"

import { AppProvider, useApp } from "~lib/providers/AppProvider"
import { useSaveFlow } from "~lib/hooks/useSaveFlow"
import { memoryService } from "~lib/services/memory"
import { getPrompt, insert } from "~lib/services/messaging"
import { fadeRise, listStagger, spring } from "~lib/animations"
import { Button } from "~lib/components/Button"
import { ProgressStages } from "~lib/components/ProgressStages"
import { ConnectScreen } from "~lib/components/ConnectScreen"
import { WorkspaceRow } from "~lib/components/WorkspaceRow"
import { Toast } from "~lib/components/Toast"
import type { Workspace } from "~lib/types"

function Shell() {
  const { ready, connected, user, workspaces, connect, disconnect, refresh } = useApp()
  const [target, setTarget] = useState("")
  const [toast, setToast] = useState<string | null>(null)
  const save = useSaveFlow(refresh)

  const flash = (m: string, ms = 1500) => {
    setToast(m)
    setTimeout(() => setToast((t) => (t === m ? null : t)), ms)
  }

  const targetId = target || workspaces[0]?.folder_id

  const onSave = async () => {
    save.reset()
    await save.run({ folderId: targetId })
    setTimeout(save.reset, 2600)
  }

  const onSaveNew = async () => {
    const name = window.prompt("New workspace name")
    if (!name) return
    save.reset()
    await save.run({ folderName: name })
    setTimeout(save.reset, 2600)
  }

  const onOptimize = async () => {
    const cur = await getPrompt()
    if (!cur?.text) return flash("Nothing to optimize")
    flash("Optimizing…", 4000)
    try {
      const optimized = await memoryService.optimize(cur.text)
      await insert(optimized)
      flash("Prompt optimized")
    } catch (e: any) {
      flash(e?.message || "Optimize failed")
    }
  }

  const onDeploy = async (ws: Workspace) => {
    flash("Finding relevant memory…", 5000)
    try {
      const cur = await getPrompt()
      const res = await memoryService.deploy(ws.folder_id, cur?.text || "")
      await insert(res.context)
      flash("Deployed")
    } catch (e: any) {
      flash(e?.message || "Nothing to deploy")
    }
  }

  return (
    <div className="w-[360px] bg-offwhite text-ink p-5" style={{ fontFamily: "Inter" }}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-7 h-7 rounded-[10px] bg-ink flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-white memory-glow" />
        </div>
        <span className="font-semibold tracking-tight">Bounce</span>
        {connected && (
          <span className="ml-auto text-[11px] text-success flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-success" /> Connected
          </span>
        )}
      </div>

      {!ready ? (
        <div className="h-40 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
        </div>
      ) : !connected ? (
        <ConnectScreen onConnect={connect} />
      ) : (
        <motion.div variants={fadeRise} initial="hidden" animate="show">
          <div className="mb-3">
            <label className="text-[11px] font-medium text-[#9ca3af]">Save to workspace</label>
            <select
              data-testid="workspace-select"
              value={targetId}
              onChange={(e) => setTarget(e.target.value)}
              className="mt-1 w-full h-9 px-2 rounded-[10px] border border-black/10 bg-white text-sm outline-none focus:ring-2 focus:ring-[rgba(79,70,229,0.3)]">
              {workspaces.map((w) => (
                <option key={w.folder_id} value={w.folder_id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <ActionTile icon={Sparkles} label="Optimize" onClick={onOptimize} testId="optimize-btn" />
            <ActionTile icon={Save} label="Save" onClick={onSave} testId="save-btn" />
            <ActionTile icon={FolderPlus} label="New" onClick={onSaveNew} testId="save-new-btn" />
          </div>

          {save.stage !== "idle" && (
            <div className="mb-4 p-3 rounded-[14px] bg-white border border-black/[0.06]" data-testid="save-status">
              <ProgressStages stage={save.stage} />
              {save.stage === "ready" && save.result && (
                <motion.div variants={fadeRise} initial="hidden" animate="show" className="mt-2">
                  <p className="text-sm font-medium tracking-tight">{save.result.memory.title}</p>
                  <p className="text-[11px] text-[#6b7280]">
                    Workspace v{save.result.memory_version} · {save.result.folder.name}
                  </p>
                  {save.result.next_recommendation && (
                    <p className="text-xs text-[#374151] mt-1.5 leading-relaxed">
                      <span className="text-accent font-medium">Next:</span> {save.result.next_recommendation}
                    </p>
                  )}
                </motion.div>
              )}
              {save.error && <p className="text-xs text-red-500 mt-1">{save.error}</p>}
            </div>
          )}

          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af] mb-2">Workspaces</p>
          <motion.div variants={listStagger} initial="hidden" animate="show" className="space-y-1.5 max-h-[220px] overflow-y-auto">
            {workspaces.slice(0, 8).map((w) => (
              <WorkspaceRow key={w.folder_id} ws={w} onDeploy={onDeploy} />
            ))}
          </motion.div>

          <button
            onClick={disconnect}
            data-testid="disconnect-btn"
            className="mt-4 text-[11px] text-[#9ca3af] hover:text-ink transition-colors flex items-center gap-1.5">
            <LogOut className="w-3 h-3" /> Disconnect {user?.email ? `· ${user.email}` : ""}
          </button>
        </motion.div>
      )}

      <Toast message={toast} />
    </div>
  )
}

function ActionTile({ icon: Icon, label, onClick, testId }: any) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      transition={spring}
      onClick={onClick}
      data-testid={testId}
      className="flex flex-col items-center gap-1.5 py-3 rounded-[14px] bg-white border border-black/[0.06]">
      <Icon className="w-4 h-4 text-accent" />
      <span className="text-[11px] font-medium">{label}</span>
    </motion.button>
  )
}

export default function Popup() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
