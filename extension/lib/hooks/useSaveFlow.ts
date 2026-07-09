import { useCallback, useState } from "react"
import { memoryService } from "~lib/services/memory"
import { capture } from "~lib/services/messaging"
import type { SaveResult, SaveStage } from "~lib/types"

// Orchestrates the Save pipeline as a calm, staged experience:
// Understanding -> Organizing -> Building Memory -> Memory Ready.
export function useSaveFlow(onSaved?: () => void) {
  const [stage, setStage] = useState<SaveStage>("idle")
  const [result, setResult] = useState<SaveResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = useCallback(() => {
    setStage("idle")
    setResult(null)
    setError(null)
  }, [])

  const run = useCallback(
    async (opts: { folderId?: string; folderName?: string }) => {
      setError(null)
      const cap = await capture()
      if (!cap?.conversation) {
        setError("No conversation found on this page")
        setStage("error")
        return
      }
      setStage("understanding")
      try {
        await new Promise((r) => setTimeout(r, 420))
        setStage("organizing")
        const res = await memoryService.save({
          conversation: cap.conversation,
          folder_id: opts.folderId,
          folder_name: opts.folderName,
          source_platform: cap.platform,
          source_url: cap.url
        })
        setStage("building")
        await new Promise((r) => setTimeout(r, 360))
        setResult(res)
        setStage("ready")
        onSaved?.()
      } catch (e: any) {
        setError(e?.message || "Save failed")
        setStage("error")
      }
    },
    [onSaved]
  )

  return { stage, result, error, run, reset }
}
