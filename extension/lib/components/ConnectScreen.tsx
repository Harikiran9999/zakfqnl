import { useState } from "react"
import { motion } from "framer-motion"
import { Puzzle } from "lucide-react"
import { fadeRise } from "~lib/animations"
import { Button } from "~lib/components/Button"

export function ConnectScreen({ onConnect }: { onConnect: (code: string) => Promise<boolean> }) {
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const submit = async () => {
    if (!code.trim()) return
    setBusy(true)
    setFailed(false)
    const ok = await onConnect(code)
    setBusy(false)
    if (!ok) setFailed(true)
  }

  return (
    <motion.div variants={fadeRise} initial="hidden" animate="show" className="space-y-4" data-testid="connect-screen">
      <div className="w-9 h-9 rounded-[12px] bg-[rgba(79,70,229,0.14)] flex items-center justify-center">
        <Puzzle className="w-4 h-4 text-accent" />
      </div>
      <div>
        <p className="text-sm font-medium">Connect your account</p>
        <p className="text-xs text-[#6b7280] leading-relaxed mt-1">
          Open the Bounce dashboard, copy your connection code, and paste it below.
        </p>
      </div>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Paste connection code"
        data-testid="connect-input"
        className="w-full h-10 px-3 rounded-[12px] border border-black/10 text-xs outline-none focus:ring-2 focus:ring-[rgba(79,70,229,0.3)]"
      />
      {failed && <p className="text-xs text-red-500">That code didn't work. Try copying it again.</p>}
      <Button full onClick={submit} disabled={busy || !code.trim()}>
        {busy ? "Connecting…" : "Connect"}
      </Button>
    </motion.div>
  )
}
