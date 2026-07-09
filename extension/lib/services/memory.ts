// Memory service — the contract the UI depends on. The backend implementation lives
// here today; swapping in a different transport later requires no UI changes.

import { request } from "~lib/services/http"
import type { User, Workspace, SavePayload, SaveResult, DeployResult } from "~lib/types"

export interface IMemoryService {
  me(): Promise<User>
  listWorkspaces(): Promise<Workspace[]>
  createWorkspace(name: string): Promise<Workspace>
  save(payload: SavePayload): Promise<SaveResult>
  deploy(folderId: string, currentPrompt: string): Promise<DeployResult>
  optimize(prompt: string): Promise<string>
}

class BackendMemoryService implements IMemoryService {
  me() {
    return request<User>("/auth/me")
  }
  listWorkspaces() {
    return request<Workspace[]>("/folders")
  }
  createWorkspace(name: string) {
    return request<Workspace>("/folders", { method: "POST", body: JSON.stringify({ name }) })
  }
  save(payload: SavePayload) {
    return request<SaveResult>("/memory/save", { method: "POST", body: JSON.stringify(payload) })
  }
  deploy(folderId: string, currentPrompt: string) {
    return request<DeployResult>("/memory/deploy", {
      method: "POST",
      body: JSON.stringify({ folder_id: folderId, current_prompt: currentPrompt })
    })
  }
  async optimize(prompt: string) {
    const r = await request<{ optimized: string }>("/optimize", {
      method: "POST",
      body: JSON.stringify({ prompt })
    })
    return r.optimized
  }
}

// Service locator — the single place to swap implementations.
export const memoryService: IMemoryService = new BackendMemoryService()
