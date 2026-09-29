import { PageHeader } from "@/components/shell/page-header";
import { listCorrections } from "@/modules/assessment/correction-queries";
import { CorrectionsTable, type CorrectionListRow } from "@/modules/assessment/correction-views";

export const metadata = { title: "Result corrections · Administration" };

// C-14 for administrators (P-12): every correction; an administrator may approve or decline as the second person.
// Coordinators propose; an administrator does not.
export default async function AdminCorrectionsPage() {
  const corrections = await listCorrections();
  const waiting = corrections.filter((row) => row.state === "proposed" && row.may_conclude).length;
  return (
    <div className="page">
      <PageHeader
        lead={
          waiting === 0
            ? "Corrections of released outcomes, proposed by coordinators. None is waiting for you."
            : `${waiting} ${waiting === 1 ? "correction is" : "corrections are"} waiting for a second person. You may approve or decline any you took no decision on.`
        }
        title="Result corrections"
        workspace="Administration"
      />
      <CorrectionsTable base="/admin/corrections" rows={corrections as CorrectionListRow[]} />
    </div>
  );
}
