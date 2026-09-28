import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// X-04 (S3-07): one person's roles, open allocations and change history. Administrators only; the database checks.

const isUuid = (value: string) => z.string().uuid().safeParse(value).success;

async function call<T>(name: string, run: () => PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await run();
  if (error) throw new Error(`api.${name} failed: ${error.message}`);
  return data;
}

export async function getAccount(profileId: string) {
  if (!isUuid(profileId)) return null;
  const supabase = await createClient();
  const rows = await call("get_account", () => supabase.rpc("get_account", { p_profile_id: profileId }));
  return rows?.[0] ?? null;
}

export async function getAccountRoles(profileId: string) {
  const supabase = await createClient();
  const [assignments, allocations, history, scopes] = await Promise.all([
    call("list_account_role_assignments", () =>
      supabase.rpc("list_account_role_assignments", { p_profile_id: profileId }),
    ),
    call("list_account_open_allocations", () =>
      supabase.rpc("list_account_open_allocations", { p_profile_id: profileId }),
    ),
    call("list_account_history", () => supabase.rpc("list_account_history", { p_profile_id: profileId })),
    call("list_role_scopes", () => supabase.rpc("list_role_scopes")),
  ]);
  return {
    assignments: assignments ?? [],
    allocations: allocations ?? [],
    history: history ?? [],
    scopes: scopes ?? [],
  };
}
