(() => {
    const currentOrigin = window.location.origin;
    const bloodLinkWorkerPaths = [
        "/service-worker.js",
        "/service-worker.published.js"
    ];
    const bloodLinkCachePatterns = [
        /^bloodlink/i,
        /^blazor-resources-/i,
        /^dotnet-resources-/i,
        /^offline-cache-/i,
        /^BloodLink\.Web/i
    ];

    const isCurrentOriginUrl = value => {
        try { return new URL(value, currentOrigin).origin === currentOrigin; }
        catch { return false; }
    };

    const isBloodLinkWorker = registration => {
        if (!isCurrentOriginUrl(registration.scope)) return false;
        const workers = [registration.installing, registration.waiting, registration.active].filter(Boolean);
        if (workers.length === 0) return true;
        return workers.every(worker => {
            try {
                const script = new URL(worker.scriptURL);
                return script.origin === currentOrigin && bloodLinkWorkerPaths.includes(script.pathname);
            }
            catch {
                return false;
            }
        });
    };

    const isBloodLinkCache = name => bloodLinkCachePatterns.some(pattern => pattern.test(name));

    window.bloodLinkServiceWorkerCleanup = (async () => {
        const result = { registrationsRemoved: 0, cachesDeleted: [] };

        if ("serviceWorker" in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            const ownedRegistrations = registrations.filter(isBloodLinkWorker);
            const removals = await Promise.all(ownedRegistrations.map(registration => registration.unregister()));
            result.registrationsRemoved = removals.filter(Boolean).length;
        }

        if ("caches" in window) {
            const names = await caches.keys();
            const ownedCaches = names.filter(isBloodLinkCache);
            const deleted = await Promise.all(ownedCaches.map(async name => ({ name, deleted: await caches.delete(name) })));
            result.cachesDeleted = deleted.filter(item => item.deleted).map(item => item.name);
        }

        return result;
    })().catch(error => ({ error: error instanceof Error ? error.message : "Service-worker cleanup failed." }));
})();
