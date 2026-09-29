import { notFound } from "next/navigation";
import { getPublicSettings } from "@/modules/audit/settings";
import { getCorrection } from "@/modules/assessment/correction-queries";
import { CorrectionDetail, type CorrectionDetailRow } from "@/modules/assessment/correction-views";

export const metadata = { title: "Correction · Administration" };

// C-14 for administrators (P-12): one correction beside the decision it corrects; approve or decline.
export default async function AdminCorrectionPage({
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
      base="/admin/corrections"
      correction={correction as CorrectionDetailRow}
      flash={flash}
      workspace="Administration"
    />
  );
}
