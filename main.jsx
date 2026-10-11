import { createRoot } from "react-dom/client";
import App from "APP";
import { installStorage } from "./storage.js";
import { SyncBar, syncJournal, getCfg } from "./sync.jsx";

/* global __SITE_ID__ */
const SITE_ID = __SITE_ID__;

installStorage();
document.body.style.paddingBottom = "48px";

const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r({ state: "error", msg: "GitHub ne répond pas (délai)" }), ms))]);

(async () => {
  // Le journal GitHub est relu AVANT l'affichage : l'application démarre
  // directement avec les sessions saisies sur les autres appareils.
  let initial = { state: "off" };
  if (getCfg()) initial = await withTimeout(syncJournal(SITE_ID), 6000);
  createRoot(document.getElementById("root")).render(
    <>
      <App />
      <SyncBar siteId={SITE_ID} initial={initial} />
    </>
  );
})();

// Hors ligne sur le spot : l'application (et donc la marée calculée) reste disponible.
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  navigator.serviceWorker.register("sw.js", { scope: "./" }).catch(() => {});
}
