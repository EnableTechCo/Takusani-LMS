"use client";

import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/icons";

/** The parts of the Navigation API this uses; browsers without it fall back to the History API. */
interface HistoryNavigation extends EventTarget {
  readonly canGoBack: boolean;
  readonly canGoForward: boolean;
}

const navigationApi = () => (window as Window & { navigation?: HistoryNavigation }).navigation;

function subscribe(onChange: () => void) {
  // Next.js writes the URL from inside a React insertion effect, and the Navigation API reports the change
  // synchronously there; React forbids updates at that point, so read the new state on the next task.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const later = () => {
    clearTimeout(timer);
    timer = setTimeout(onChange, 0);
  };
  const navigation = navigationApi();
  const target: EventTarget = navigation ?? window;
  const event = navigation ? "currententrychange" : "popstate";
  target.addEventListener(event, later);
  return () => {
    clearTimeout(timer);
    target.removeEventListener(event, later);
  };
}

/** "back,forward" as 0s and 1s, so the snapshot is a stable string. */
function snapshot(): string {
  const navigation = navigationApi();
  if (navigation) return `${Number(navigation.canGoBack)},${Number(navigation.canGoForward)}`;
  // Without the Navigation API the browser cannot say: Back when the tab has history, Forward always.
  return `${Number(window.history.length > 1)},1`;
}

/** Both disabled on the server and in the first client render, so they agree. */
const serverSnapshot = () => "0,0";

/**
 * Back and Forward in the top bar: the browser's own history, so they go where the browser's buttons would, and are
 * disabled when there is nowhere to go (for example back from the first page opened). Phones show Back only.
 */
export function HistoryButtons() {
  const router = useRouter();
  const [back, forward] = useSyncExternalStore(subscribe, snapshot, serverSnapshot).split(",").map(Number);

  return (
    <div aria-label="History" className="topbar__history" role="group">
      <button
        aria-label="Back"
        className="btn btn--ghost btn--icon"
        disabled={!back}
        onClick={() => router.back()}
        title="Back"
        type="button"
      >
        <Icon name="arrow-left" />
      </button>
      <button
        aria-label="Forward"
        className="btn btn--ghost btn--icon topbar__forward"
        disabled={!forward}
        onClick={() => router.forward()}
        title="Forward"
        type="button"
      >
        <Icon name="arrow-right" />
      </button>
    </div>
  );
}
