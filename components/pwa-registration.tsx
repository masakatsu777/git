"use client";

import { useEffect } from "react";

export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        void registration.unregister();
      }
    }).catch(() => {
      // Service worker cleanup should not block normal app usage.
    });

    if (!("caches" in window)) return;

    void window.caches.keys().then((keys) => {
      for (const key of keys) {
        void window.caches.delete(key);
      }
    }).catch(() => {
      // Cache cleanup should not block normal app usage.
    });
  }, []);

  return null;
}
