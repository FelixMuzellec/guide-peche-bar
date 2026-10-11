// Sonde de stockage partagée (une seule sonde pour toute l'application).
import { SITE } from "SITE_CONFIG";

// ─────────────────────────────────────────────────────────────────
// v4.4 — PERSISTANCE : SONDE RÉELLE ET ÉCRITURE NON DESTRUCTIVE
//
// Deux défauts corrigés ici, tous deux causes de perte du journal.
//
// 1. La détection se contentait de vérifier l'existence de window.storage.
//    Un environnement peut exposer l'objet et refuser l'écriture. On fait
//    désormais un aller-retour réel : on écrit un jeton, on le relit, on
//    compare. C'est la seule preuve qui vaille.
//
// 2. La lecture avalait TOUTES les erreurs et retournait un tableau vide.
//    Une lecture ratée devenait donc un journal vide, et la session suivante
//    écrasait l'historique complet. Une lecture ratée et un journal
//    réellement vide sont maintenant deux états distincts, et l'écriture est
//    BLOQUÉE tant que la lecture n'a pas réussi. Mieux vaut refuser d'écrire
//    que détruire ce qu'on n'a pas su lire.
// ─────────────────────────────────────────────────────────────────
export let STORAGE_STATE = null;
export let STORAGE_PROBE = null;   // v6 : une seule sonde, partagée par tous les appelants

export function probeStorage() {
  if (!STORAGE_PROBE) STORAGE_PROBE = probeStorageOnce();
  return STORAGE_PROBE;
}
export async function probeStorageOnce() {
  if (STORAGE_STATE) return STORAGE_STATE;
  if (typeof window === "undefined" || !window.storage) {
    STORAGE_STATE = { ok: false, reason: "Aucune API de stockage dans cet environnement d'exécution." };
    return STORAGE_STATE;
  }
  try {
    const k = "bar:probe:" + SITE.id;
    const token = "p" + Date.now() + "-" + Math.random().toString(36).slice(2);
    await window.storage.set(k, token);
    const r = await window.storage.get(k);
    STORAGE_STATE = r?.value === token
      ? { ok: true, reason: "" }
      : { ok: false, reason: "L'écriture est acceptée mais la relecture ne rend pas la même valeur." };
  } catch (e) {
    STORAGE_STATE = { ok: false, reason: e?.message || "Erreur de stockage à l'écriture." };
  }
  return STORAGE_STATE;
}
