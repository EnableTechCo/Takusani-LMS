"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConsequenceDialog } from "@/components/ui/dialog";
import { SubmitButton } from "@/components/ui/form-feedback";
import { Banner } from "@/components/ui/status";
import { useToast } from "@/components/ui/toast";
import type { FormState } from "@/lib/form-state";
import { createFeedLink, revokeFeedLink } from "./calendar-feed-actions";

/**
 * L-08 (FR-304): create the feed link, copy it once, and later replace or revoke it. The link is shown only straight
 * after it is made: the LMS keeps a fingerprint of it, not the link.
 */
export function FeedLinkPanel({ active, feedBase }: { active: boolean; feedBase: string }) {
  const [state, action] = useActionState(createFeedLink, {} as FormState);
  const toast = useToast();
  const [copyRefused, setCopyRefused] = useState(false);
  const token = state.values?.token;
  const url = token ? `${feedBase}${token}.ics` : null;
  const webcal = url?.replace(/^https?:\/\//, "webcal://") ?? null;

  return (
    <div className="stack">
      {state.message ? <Banner title={state.message} tone="critical" /> : null}

      {url ? (
        <div className="stack">
          <Banner role="status" title="Your calendar link is ready" tone="positive">
            <p>
              Copy it now: it is shown only this once. Anyone with the link can see your timetable, so keep it to
              yourself.
            </p>
          </Banner>
          <label className="field">
            <span className="field__label">Your calendar link</span>
            <input className="input input--mono" onFocus={(event) => event.target.select()} readOnly value={url} />
          </label>
          <div className="cluster">
            <Button
              icon="copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopyRefused(false);
                  toast.show({ title: "Link copied" });
                } catch {
                  setCopyRefused(true);
                }
              }}
              variant="primary"
            >
              Copy link
            </Button>
            <a className="link link--standalone" href={webcal!}>
              Open in your calendar app
            </a>
          </div>
          {copyRefused ? (
            <p className="text-small" role="status">
              This browser did not allow copying. Select the link above and copy it yourself.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="cluster">
        {active || url ? (
          <form action={action} id="rotate-feed-form">
            <ConsequenceDialog
              cancelLabel="Keep the current link"
              confirmLabel="Make a new link"
              consequence="Your current link stops working at once. Calendars subscribed to it stop updating until you add the new one."
              form="rotate-feed-form"
              title="Make a new calendar link?"
              trigger={{ label: "Make a new link", variant: "secondary" }}
            />
          </form>
        ) : (
          <form action={action}>
            <SubmitButton pendingLabel="Creating the link">Create link</SubmitButton>
          </form>
        )}
        {active || url ? (
          <form action={revokeFeedLink} id="revoke-feed-form">
            <ConsequenceDialog
              cancelLabel="Keep it"
              confirmLabel="Turn off the link"
              consequence="The link stops working at once, and calendars subscribed to it stop updating. You can create a new one at any time."
              form="revoke-feed-form"
              title="Turn off your calendar link?"
              trigger={{ label: "Turn off the link", variant: "ghost" }}
            />
          </form>
        ) : null}
      </div>
    </div>
  );
}
