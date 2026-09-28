import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// X-05 and X-06 (S3-09): administrators only; the database checks.

export async function listConfiguration() {
  const supabase = await createClient();
  const [settings, units] = await Promise.all([
    supabase.rpc("list_configuration"),
    supabase.rpc("list_unit_credit_values"),
  ]);
  if (settings.error) throw new Error(`api.list_configuration failed: ${settings.error.message}`);
  if (units.error) throw new Error(`api.list_unit_credit_values failed: ${units.error.message}`);
  return { settings: settings.data ?? [], units: units.data ?? [] };
}

export async function getConfigurationKey(key: string) {
  if (!/^[a-z_.]{3,80}$/.test(key)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_configuration_key", { p_key: key });
  if (error) throw new Error(`api.get_configuration_key failed: ${error.message}`);
  return data?.[0] ?? null;
}

export async function getUnitCreditHistory(unitId: string) {
  if (!z.string().uuid().safeParse(unitId).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_unit_credit_history", { p_unit_id: unitId });
  if (error) throw new Error(`api.get_unit_credit_history failed: ${error.message}`);
  return data?.[0] ?? null;
}
