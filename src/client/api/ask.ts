import { request } from "./rpc-client"

export interface AskChat {
  id: string
  name: string
  createdAt: number
  opencodeSessionId: string
}

export function createAskChat(): Promise<{ id: string; opencodePort: number; cwd: string; opencodeSessionId: string }> {
  return request("createAskChat")
}

export function listAskChats(): Promise<AskChat[]> {
  return request("listAskChats")
}

export function renameAskChat(id: string, name: string): Promise<void> {
  return request("renameAskChat", { id, name })
}

export function deleteAskChat(id: string): Promise<void> {
  return request("deleteAskChat", { id })
}
