// Deploy guard for ADR-027: Vercel functions must run in the same region as the Supabase database,
// or every database call crosses continents. The deploy workflow runs this before each environment deploys.
//
// Usage: node scripts/deploy-region.mjs <supabase-project-ref>
// Needs SUPABASE_ACCESS_TOKEN. Exits 1 if vercel.json's function region does not match the project's region.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Supabase region -> nearest Vercel function region (same cloud region where both exist). */
export const SUPABASE_TO_VERCEL = {
  "eu-west-1": "dub1",
  "eu-west-2": "lhr1",
  "eu-west-3": "cdg1",
  "eu-central-1": "fra1",
  "eu-north-1": "arn1",
  "us-east-1": "iad1",
  "us-east-2": "cle1",
  "us-west-1": "sfo1",
  "us-west-2": "pdx1",
  "ca-central-1": "yul1",
  "sa-east-1": "gru1",
  "ap-south-1": "bom1",
  "ap-southeast-1": "sin1",
  "ap-southeast-2": "syd1",
  "ap-northeast-1": "hnd1",
  "ap-northeast-2": "icn1",
};

/** Returns null when aligned, or a message explaining the mismatch. */
export function checkRegions(supabaseRegion, vercelRegions) {
  const expected = SUPABASE_TO_VERCEL[supabaseRegion];
  if (!expected) return `No Vercel region is mapped for Supabase region "${supabaseRegion}". Add it to scripts/deploy-region.mjs.`;
  if (!Array.isArray(vercelRegions) || vercelRegions.length !== 1) {
    return `vercel.json must pin exactly one function region; found ${JSON.stringify(vercelRegions)}.`;
  }
  if (vercelRegions[0] !== expected) {
    return `Supabase project is in ${supabaseRegion}, so vercel.json "regions" must be ["${expected}"], not ["${vercelRegions[0]}"].`;
  }
  return null;
}

async function main() {
  const ref = process.argv[2];
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!ref || !token) {
    console.error("Usage: SUPABASE_ACCESS_TOKEN=... node scripts/deploy-region.mjs <project-ref>");
    process.exit(2);
  }

  const response = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(ref)}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    console.error(`Could not read the Supabase project (HTTP ${response.status}).`);
    process.exit(1);
  }
  const { region } = await response.json();
  const vercel = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const problem = checkRegions(region, vercel.regions);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
  console.log(`Regions aligned: Supabase ${region}, Vercel ${vercel.regions[0]}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
