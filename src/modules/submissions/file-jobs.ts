import "server-only";
import { after } from "next/server";
import { hasServerEnvironment } from "@/config/env";
import { createWorkerClient } from "@/lib/supabase/admin";
import { cleanUpOrphans, scanFiles, type CleanupSummary, type ScanSummary } from "./file-scan";

/** One scan run with this deployment's Storage. */
export async function runFileScan(): Promise<ScanSummary> {
  const client = createWorkerClient();
  return scanFiles({
    client,
    read: async (bucket, objectKey) => {
      const { data, error } = await client.storage.from(bucket).download(objectKey);
      if (error || !data) throw new Error(error?.message ?? "no data");
      return new Uint8Array(await data.arrayBuffer());
    },
  });
}

/** One orphan clean-up run with this deployment's Storage. */
export async function runUploadCleanup(): Promise<CleanupSummary> {
  const client = createWorkerClient();
  return cleanUpOrphans({
    client,
    remove: async (bucket, objectKeys) => {
      const { error } = await client.storage.from(bucket).remove(objectKeys);
      if (error) throw new Error(error.message);
    },
  });
}

/**
 * After the response is sent, scan the file just finalised, so its checksum and real type are known within seconds
 * rather than at the next scheduled run. Best effort: if it fails, the scheduled run scans it.
 *
 * Does nothing without the secret key, as on staging until go-live: files then stay "pending", which blocks nothing.
 */
export function scanSoon(): void {
  if (!hasServerEnvironment()) return;
  after(async () => {
    try {
      await runFileScan();
    } catch (error) {
      console.error("file scan after upload failed; the scheduled run will retry", error);
    }
  });
}
