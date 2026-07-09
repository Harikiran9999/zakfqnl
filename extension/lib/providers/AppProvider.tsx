import { createContext, useCallback, useContext, useEffect, useState } from "react"
import type { ReactNode } from "react"
import { memoryService } from "~lib/services/memory"
import { sessionStore } from "~lib/storage/session"
import type { User, Workspace } from "~lib/types"

interface AppState {
  ready: boolean
  connected: boolean
  user: User | null
  workspaces: Workspace[]
  connect: (code: string) => Promise<boolean>
  disconnect: () => Promise<void>
  refresh: () => Promise<void>
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [connected, setConnected] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

  const refresh = useCallback(async () => {
    try {
      const [me, ws] = await Promise.all([
        memoryService.me(),
        memoryService.listWorkspaces()
      ])
      setUser(me)
      setWorkspaces(ws)
      setConnected(true)
    } catch {
      setConnected(false)
      setUser(null)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const connect = useCallback(
    async (code: string) => {
      await sessionStore.set(code.trim())
      await refresh()
      const ok = (await memoryService.me().then(() => true).catch(() => false))
      return ok
    },
    [refresh]
  )

  const disconnect = useCallback(async () => {
    await sessionStore.clear()
    setConnected(false)
    setUser(null)
    setWorkspaces([])
  }, [])

  return (
    <AppContext.Provider value={{ ready, connected, user, workspaces, connect, disconnect, refresh }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
