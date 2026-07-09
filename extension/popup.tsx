import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Rocket, Sparkles, Save, FolderPlus, Check, Loader2, Puzzle } from "lucide-react"
import { api, getToken, setToken, clearToken } from "~lib/api"
import "~style.css"

type Folder = { folder_id: string; name: string; memory_count: number }

const spring = { type: "spring", stiffness: 220, damping: 22 } as const

function useActiveTab() {
  const send = (message: any): Promise<any> =>
    new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (!tab?.id) return resolve(null)
        chrome.tabs.sendMessage(tab.id, message, (res) => resolve(res))
      })
    })
  return { send }
}

export default function Popup() {
  const [ready, setReady] = useState(false)
  const [connected, setConnected] = useState(false)
  const [code, setCode] = useState("")
  const [folders, setFolders] = useState<Folder[]>([])
  const [stage, setStage] = useState<string | null>(null)
  const { send } = useActiveTab()

  const refresh = async () => {
    try {
      await api.me()
      setConnected(true)
      const f = await api.folders()
      setFolders(f)
    } catch {
      setConnected(false)
    } finally {
      setReady(true)
    }
  }

  useEffect(() => { refresh() }, [])

  const connect = async () => {
    if (!code.trim()) return
    await setToken(code.trim())
    setCode("")
    await refresh()
  }

  const flash = (msg: string, ms = 1400) => {
    setStage(msg)
    setTimeout(() => setStage(null), ms)
  }

  const runSave = async (asNew = false) => {
    const cap = await send({ type: "CAPTURE" })
    if (!cap?.text) return flash("No conversation found")
    setStage("Understanding…")
    try {
      const body: any = { conversation: cap.text, source_platform: cap.platform, source_url: cap.url }
      if (asNew) {
        const name = window.prompt("New folder name")
        if (!name) return setStage(null)
        body.folder_name = name
      } else {
        body.folder_id = folders[0]?.folder_id
      }
      setStage("Organizing…")
      await api.save(body)
      setStage("Memory Ready")
      await refresh()
      setTimeout(() => setStage(null), 1200)
    } catch (e: any) {
      flash(e.message || "Save failed")
    }
  }

  const runOptimize = async () => {
    const cur = await send({ type: "GET_INPUT" })
    if (!cur?.text) return flash("Nothing to optimize")
    setStage("Optimizing…")
    try {
      const res = await api.optimize(cur.text)
      await send({ type: "INSERT", text: res.optimized })
      flash("Prompt optimized")
    } catch (e: any) { flash(e.message || "Failed") }
  }

  const runDeploy = async (folder_id: string) => {
    setStage("Deploying…")
    try {
      const res = await api.deploy(folder_id)
      await send({ type: "INSERT", text: res.context })
      flash("Deployed")
    } catch (e: any) { flash(e.message || "Nothing to deploy") }
  }

  return (
    <div className="w-[360px] bg-offwhite text-ink p-5" style={{ fontFamily: "Inter" }}>
      <div className="flex items-center gap-2.5 mb-5">
        <div className="w-7 h-7 rounded-[10px] bg-ink flex items-center justify-center">
          <span className="w-2 h-2 rounded-full bg-white memory-glow" />
        </div>
        <span className="font-semibold tracking-tight">Bounce</span>
        {connected && (
          <span className="ml-auto text-[11px] text-[#10B981] flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" /> Connected
          </span>
        )}
      </div>

      {!ready ? (
        <div className="h-40 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-accent" />
        </div>
      ) : !connected ? (
        <div className="space-y-3">
          <div className="w-9 h-9 rounded-[12px] bg-[rgba(79,70,229,0.14)] flex items-center justify-center">
            <Puzzle className="w-4 h-4 text-accent" />
          </div>
          <p className="text-sm font-medium">Connect your account</p>
          <p className="text-xs text-[#6b7280] leading-relaxed">
            Open the Bounce dashboard, copy your connection code, and paste it below.
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Paste connection code"
            className="w-full h-10 px-3 rounded-[12px] border border-black/10 text-xs outline-none focus:ring-2 focus:ring-[rgba(79,70,229,0.3)]"
          />
          <button onClick={connect}
            className="w-full h-10 rounded-full bg-ink text-white text-sm font-medium transition-transform hover:scale-[1.02]">
            Connect
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <Action icon={Sparkles} label="Optimize" onClick={runOptimize} />
            <Action icon={Save} label="Save" onClick={() => runSave(false)} />
            <Action icon={FolderPlus} label="New folder" onClick={() => runSave(true)} />
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9ca3af] mb-2">Recent</p>
          <div className="space-y-1.5 max-h-[220px] overflow-y-auto">
            {folders.slice(0, 8).map((f) => (
              <motion.div key={f.folder_id} whileHover={{ scale: 1.01 }} transition={spring}
                className="flex items-center justify-between px-3 py-2.5 rounded-[12px] bg-white border border-black/[0.06] group">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <p className="text-[11px] text-[#9ca3af]">{f.memory_count} memories</p>
                </div>
                <button onClick={() => runDeploy(f.folder_id)}
                  className="p-2 rounded-lg text-accent hover:bg-[rgba(79,70,229,0.12)] transition-colors" title="Deploy">
                  <Rocket className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>

          <button onClick={async () => { await clearToken(); setConnected(false) }}
            className="mt-4 text-[11px] text-[#9ca3af] hover:text-ink transition-colors">Disconnect</button>
        </>
      )}

      <AnimatePresence>
        {stage && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            transition={spring}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-ink text-white text-xs font-medium flex items-center gap-2">
            {stage === "Memory Ready" || stage === "Deployed" || stage === "Prompt optimized"
              ? <Check className="w-3.5 h-3.5 text-[#10B981]" strokeWidth={3} />
              : <span className="w-1.5 h-1.5 rounded-full bg-accent memory-glow" />}
            {stage}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Action({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} transition={spring} onClick={onClick}
      className="flex flex-col items-center gap-1.5 py-3 rounded-[14px] bg-white border border-black/[0.06]">
      <Icon className="w-4 h-4 text-accent" />
      <span className="text-[11px] font-medium">{label}</span>
    </motion.button>
  )
}
