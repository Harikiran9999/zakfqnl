// Shared domain types for the Bounce extension.

export interface User {
  user_id: string
  email: string
  name: string
  picture?: string
  provider?: string
}

export interface Workspace {
  folder_id: string
  name: string
  memory_count: number
}

export interface CompactMemory {
  goal: string
  project: string
  decisions: string[]
  todos: string[]
  technologies: string[]
  summary: string
}

export interface SaveResult {
  memory: { memory_id: string; title: string; structured: CompactMemory }
  folder: { folder_id: string; name: string }
  memory_version: number
  next_recommendation: string
  conversation_intent: string
}

export interface DeployResult {
  context: string
  deployment_id: string
  memory_version: number
  relevance: {
    matched_prompt: boolean
    decisions: number
    constraints: number
    technologies: number
    knowledge: number
    tasks: number
  }
}

export interface SavePayload {
  conversation: string
  folder_id?: string
  folder_name?: string
  title?: string
  source_platform?: string
  source_url?: string
}

export interface CaptureResult {
  conversation: string
  prompt: string
  platform: string
  url: string
}

export type SaveStage =
  | "idle"
  | "understanding"
  | "organizing"
  | "building"
  | "ready"
  | "error"

export const STAGE_LABEL: Record<SaveStage, string> = {
  idle: "",
  understanding: "Understanding",
  organizing: "Organizing",
  building: "Building Memory",
  ready: "Memory Ready",
  error: "Something went wrong",
}
