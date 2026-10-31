/// <reference lib="webworker" />
// Service worker: precache app shell, sounds and the TF.js model (offline obstacles).
// TODO step 6: handle POST /share from the share_target -> hand the file to Read mode.
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

self.skipWaiting();
precacheAndRoute(self.__WB_MANIFEST);
