import { request } from "./rpc-client"
import type { CheckUpdatesResponse, DownloadUpdateResponse } from "../../shared/types"

export function checkUpdates(): Promise<CheckUpdatesResponse> {
  return request("checkUpdates")
}

export function downloadUpdate(): Promise<DownloadUpdateResponse> {
  return request("downloadUpdate")
}
