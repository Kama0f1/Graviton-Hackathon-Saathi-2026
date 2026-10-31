/// <reference lib="webworker" />
// Service worker: precache app shell, sounds and the TF.js model (offline obstacles),
// and handle POST /share from the share_target -> hand the file to Read mode.
// NOTE: share target only works once the app is INSTALLED.
// TODO: precacheAndRoute(self.__WB_MANIFEST) via workbox-precaching; fetch handler for /share.
export {};
