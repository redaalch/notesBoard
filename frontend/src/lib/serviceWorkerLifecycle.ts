const clearNotesboardCaches = async () => {
  if (!("caches" in window)) {
    return;
  }

  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith("notesboard-"))
      .map((key) => caches.delete(key)),
  );
};

export async function syncServiceWorkerRegistration(isProd: boolean) {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  try {
    if (!isProd) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => registration.unregister()),
      );
      await clearNotesboardCaches();
      return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    registration.update().catch((error: unknown) => {
      console.warn("Service worker update check failed", error);
    });
  } catch (error) {
    console.error("Service worker registration failed", error);
  }
}
