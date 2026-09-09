/**
 * TalentBusterZ V3 — offline/demo fallback helper (browser side)
 *
 * The public GitHub Pages build has no reachable backend: every fetch to
 * http://localhost:8787 will fail for a real visitor. Without this, that
 * failure surfaced as a raw, confusing error string (e.g. "Failed to
 * fetch"). This distinguishes "the backend could not be reached at all"
 * (fetch throws TypeError before any HTTP response exists) from "the
 * backend responded but with an error" (our own code throws a plain
 * Error with a real API error message), so the UI can show a clear,
 * non-technical message for the former instead of looking broken.
 */

export const OFFLINE_DEMO_MESSAGE =
  'Mode démo hors-ligne : cette action nécessite un serveur qui n’est pas déployé publiquement pour le moment. ' +
  'Cette page présente une démonstration technique du projet TalentBusterZ.'

export function isBackendUnreachable(err) {
  return err instanceof TypeError
}
