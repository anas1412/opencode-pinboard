import { request } from "./rpc-client"
import type { CheckUpdatesResponse } from "../../shared/types"

export function checkUpdates(): Promise<CheckUpdatesResponse> {
  return request("checkUpdates")
}
