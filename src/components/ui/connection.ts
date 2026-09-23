"use client";

import { useSyncExternalStore } from "react";

/** The browser's own view of the connection, read the way React wants an external value read. */
function subscribeToConnection(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** True while the browser says it has no connection. Always false on the server and in the first render. */
export function useOffline(): boolean {
  return useSyncExternalStore(
    subscribeToConnection,
    () => !navigator.onLine,
    () => false,
  );
}
