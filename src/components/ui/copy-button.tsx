"use client";

import { useState } from "react";
import { Button } from "./button";
import { useToast } from "./toast";

/**
 * Copies a short text, for example a sample record for an audit note. A copy confirms with a toast; if the browser
 * refuses, the fallback is said in the page, since a toast is never used for a problem.
 */
export function CopyButton({ text, label, copiedTitle }: { text: string; label: string; copiedTitle: string }) {
  const toast = useToast();
  const [refused, setRefused] = useState(false);
  return (
    <span className="cluster">
      <Button
        icon="copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setRefused(false);
            toast.show({ title: copiedTitle });
          } catch {
            setRefused(true);
          }
        }}
        size="sm"
        variant="ghost"
      >
        {label}
      </Button>
      {refused ? (
        <span className="text-small" role="status">
          This browser did not allow copying. Select the record and copy it yourself.
        </span>
      ) : null}
    </span>
  );
}
