"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConflictPanel } from "@/components/ui/conflict";
import { ConsequenceDialog, Dialog } from "@/components/ui/dialog";
import { ErrorSummary } from "@/components/ui/form-feedback";
import { MenuLink } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";

/** Gallery specimens that need the browser: dialogs, a toast, and an error summary (which takes focus). */

/** The summary takes focus when it appears, so it is shown on request rather than when the page loads. */
export function GalleryErrorSummary() {
  const [shown, setShown] = useState(false);
  return shown ? (
    <ErrorSummary
      errors={{ grounds: "Tell us why the mark does not reflect your work", deadline: "Choose a day in the future" }}
      labels={{}}
    />
  ) : (
    <div>
      <Button onClick={() => setShown(true)}>Show the error summary</Button>
    </div>
  );
}

export function GalleryDialogs() {
  return (
    <>
      <ConsequenceDialog
        acknowledgement="I did not assess any item that I moderated in this cycle."
        cancelLabel="Not yet"
        confirmLabel="Sign off and release 96 results"
        consequence="96 learners in 2026 Intake B will see their results straight away, and each learner's 7 days to appeal start today."
        title='Sign off "Term 3 tasks"?'
        trigger={{ label: "Sign off moderation", variant: "secondary" }}
      >
        <ul className="modal__list">
          <li>22 sampled items: 22 agreed, 0 open.</li>
          <li>Sign-off cannot be undone. You are signing off as the moderator: Anil Naidoo.</li>
        </ul>
      </ConsequenceDialog>
      <Dialog
        footer={(close) => (
          <Button onClick={close} variant="secondary">
            Close
          </Button>
        )}
        sheet
        title="Your workspaces"
        trigger={{ label: "Workspace picker sheet" }}
      >
        <MenuLink current href="/components" icon="book" meta="3 tasks due">
          Learning
        </MenuLink>
        <MenuLink href="/components" icon="clipboard" meta="12 to mark">
          Assessing
        </MenuLink>
      </Dialog>
    </>
  );
}

export function GalleryToast() {
  const toast = useToast();
  return (
    <Button onClick={() => toast.show({ title: "Reminder sent", meta: "23 Sep 2026, 10:14" })}>Show a toast</Button>
  );
}

/** A refusal moves focus to its heading when it appears, so it too is shown on request. */
export function GalleryRefusal() {
  const [shown, setShown] = useState(false);
  return shown ? (
    <ConflictPanel
      actions={<Button variant="primary">Choose another moderator</Button>}
      evidence={[
        { term: "Conflicting decision", detail: "Not yet competent, 10 Sep 2026, Lerato Mokoena, Task 3" },
        { term: "Role at the time", detail: "Assessor, 2026 Intake B" },
      ]}
      rule="BR-01 · separation_of_duties_conflict · Reference 8f41c2e0"
      title="This would break separation of duties"
    >
      Thandiwe Nkosi cannot be the moderator for this item because she assessed it. Nothing was changed.
    </ConflictPanel>
  ) : (
    <div>
      <Button onClick={() => setShown(true)}>Show a refusal</Button>
    </div>
  );
}
