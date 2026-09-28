import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { detectMediaType, SCANNER, scanVerdict } from "./file-scan-rules";

/**
 * The file scan worker and the orphan clean-up (S3-11). Both run with the secret key: straight after an upload is
 * finalised, and on a schedule as the backstop. The database decides what to scan and what may be removed; this
 * reads and removes objects, which only the Storage API can do.
 *
 * A scan claims a bounded batch (each file leased, so overlapping runs never scan the same file twice), reads each
 * object, and records the outcome. A file that cannot be read is retried later, and fails after three attempts.
 */

type WorkerClient = SupabaseClient<Database, "api">;

/** Reads an object's bytes, or throws. */
export type ReadObject = (bucket: string, objectKey: string) => Promise<Uint8Array>;
/** Removes objects from one bucket, or throws. */
export type RemoveObjects = (bucket: string, objectKeys: string[]) => Promise<void>;

export interface ScanSummary {
  claimed: number;
  clean: number;
  rejected: number;
  retried: number;
  failed: number;
  /** Outcomes the database did not take (for example a network fault); the lease runs out and the file is claimed again. */
  unrecorded: number;
}

export async function scanFiles({
  client,
  read,
  batchSize = 5,
  timeBudgetMs = 40_000,
  now = () => Date.now(),
}: {
  client: WorkerClient;
  read: ReadObject;
  batchSize?: number;
  timeBudgetMs?: number;
  now?: () => number;
}): Promise<ScanSummary> {
  const summary: ScanSummary = { claimed: 0, clean: 0, rejected: 0, retried: 0, failed: 0, unrecorded: 0 };
  const started = now();

  while (now() - started < timeBudgetMs) {
    const { data: batch, error } = await client.rpc("claim_file_scans", { p_limit: batchSize });
    if (error) throw new Error(`api.claim_file_scans failed: ${error.message}`);
    if (!batch || batch.length === 0) break;
    summary.claimed += batch.length;

    for (const file of batch) {
      let record: {
        p_outcome: "clean" | "rejected" | "retry";
        p_sha256?: string;
        p_detected_media_type?: string;
        p_reason?: string;
      };
      try {
        const bytes = await read(file.bucket, file.object_key);
        const sha256 = createHash("sha256").update(bytes).digest("hex");
        const detected = detectMediaType(bytes);
        const verdict = scanVerdict({
          length: bytes.length,
          recordedBytes: Number(file.bytes),
          sha256,
          declaredSha256: file.declared_sha256,
          detectedMediaType: detected,
          allowedMediaTypes: file.allowed_media_types ?? [],
        });
        record = {
          p_outcome: verdict.outcome,
          p_sha256: sha256,
          p_detected_media_type: detected,
          ...(verdict.reason ? { p_reason: verdict.reason } : {}),
        };
      } catch (error) {
        console.error("file scan could not read an object; it will be tried again", {
          fileId: file.file_id,
          attempt: file.attempt,
          error: error instanceof Error ? error.message : String(error),
        });
        record = { p_outcome: "retry" };
      }

      const { data: result, error: recordError } = await client.rpc("record_file_scan", {
        p_file_id: file.file_id,
        p_scanner: SCANNER,
        ...record,
      });
      const state = result?.[0]?.status === "ok" ? result[0].scan_state : null;
      if (recordError || !state) {
        summary.unrecorded += 1;
      } else if (state === "clean") {
        summary.clean += 1;
      } else if (state === "rejected") {
        summary.rejected += 1;
      } else if (state === "failed") {
        summary.failed += 1;
      } else {
        summary.retried += 1;
      }
    }
  }
  return summary;
}

export interface CleanupSummary {
  listed: number;
  removed: number;
  /** Objects Storage would not remove this time; they are listed again on the next run. */
  kept: number;
}

/** Removes the objects of uploads abandoned more than a day ago, then has the database confirm each is gone. */
export async function cleanUpOrphans({
  client,
  remove,
  limit = 200,
}: {
  client: WorkerClient;
  remove: RemoveObjects;
  limit?: number;
}): Promise<CleanupSummary> {
  const { data: orphans, error } = await client.rpc("list_orphan_uploads", { p_limit: limit });
  if (error) throw new Error(`api.list_orphan_uploads failed: ${error.message}`);
  const rows = orphans ?? [];

  const byBucket = new Map<string, { intentIds: string[]; keys: string[] }>();
  for (const row of rows) {
    const group = byBucket.get(row.bucket) ?? { intentIds: [], keys: [] };
    group.intentIds.push(row.intent_id);
    group.keys.push(row.object_key);
    byBucket.set(row.bucket, group);
  }

  const attempted: string[] = [];
  for (const [bucket, group] of byBucket) {
    try {
      await remove(bucket, group.keys);
      attempted.push(...group.intentIds);
    } catch (removeError) {
      console.error("orphan clean-up could not remove objects; they will be listed again", {
        bucket,
        count: group.keys.length,
        error: removeError instanceof Error ? removeError.message : String(removeError),
      });
    }
  }

  let removed = 0;
  if (attempted.length > 0) {
    const { data: recorded, error: recordError } = await client.rpc("record_orphans_removed", {
      p_intent_ids: attempted,
    });
    if (recordError) throw new Error(`api.record_orphans_removed failed: ${recordError.message}`);
    removed = recorded ?? 0;
  }
  return { listed: rows.length, removed, kept: rows.length - removed };
}
