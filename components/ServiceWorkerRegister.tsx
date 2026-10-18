"use client";

import { useEffect } from "react";

/**
 * The previous service worker could serve the dashboard shell for a failed
 * navigation and cache HTML cache-first. That is fixed in sw.js, but an
 * already-installed worker keeps controlling the page until it updates.
 * This component forces an update check and reloads once when the new
 * worker takes control, so a hard refresh is not required.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let reloading = false;

    const onController = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onController);

    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((reg) => {
        reg.update().catch(() => {});
        // If a waiting worker exists (new version downloaded), activate it now.
        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      })
      .catch(() => {});

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onController);
  }, []);
  return null;
}
