"use client";

import { useState } from "react";
import { Button } from "./button";
import { useToast } from "./toast";

/**
 * Print the receipt, or copy its reference. A copy confirms with a toast (small and low-stakes); if the browser
 * refuses, the fallback is said in the page, since a toast is never used for a problem.
 */
export function ReceiptActions({ reference }: { reference: string }) {
  const toast = useToast();
  const [copyRefused, setCopyRefused] = useState(false);
  return (
    <div className="receipt__actions">
      <Button icon="printer" onClick={() => window.print()} variant="secondary">
        Print
      </Button>
      <Button
        icon="copy"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(reference);
            setCopyRefused(false);
            toast.show({ title: "Reference copied", meta: reference });
          } catch {
            setCopyRefused(true);
          }
        }}
        variant="ghost"
      >
        Copy reference
      </Button>
      {copyRefused ? (
        <p className="text-small" role="status">
          This browser did not allow copying. Select the reference above and copy it yourself.
        </p>
      ) : null}
    </div>
  );
}
