import { notFound } from "next/navigation";
import { getPublicSettings } from "@/modules/audit/settings";
import { getCorrection } from "@/modules/assessment/correction-queries";
import { CorrectionDetail, type CorrectionDetailRow } from "@/modules/assessment/correction-views";

export const metadata = { title: "Correction · Coordinating" };

// C-14 (P-12): one correction beside the decision it corrects; approve or decline as the second person.
export default async function CoordinateCorrectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ correctionId: string }>;
  searchParams: Promise<{ proposed?: string; concluded?: string }>;
}) {
  const [{ correctionId }, flash] = await Promise.all([params, searchParams]);
  const [correction, settings] = await Promise.all([getCorrection(correctionId), getPublicSettings()]);
  if (!correction) notFound();
  return (
    <CorrectionDetail
      appealWindowDays={settings.appealWindowDays}
      base="/coordinate/corrections"
      correction={correction as CorrectionDetailRow}
      flash={flash}
      workspace="Coordinating"
    />
  );
}
