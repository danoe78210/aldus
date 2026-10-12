/**
 * Garde anti-tremblement du redimensionnement de fenêtre (« window jitter »).
 *
 * Les panneaux de l'atelier (`.atelier-container`, `.book-spread`,
 * `.main-layout`) sont animés par de nombreuses transitions CSS (feuilletages,
 * volets 3D, halos, fondus). Pendant un redimensionnement manuel, ces
 * transitions redémarrent à chaque *frame* et provoquent des saccades et des
 * micro-tremblements.
 *
 * Ce garde pose la classe `is-resizing` sur `<body>` au premier événement
 * `resize`, la maintient tant que les événements s'enchaînent, puis la retire
 * `RESIZE_SETTLE_DELAY_MS` après le dernier (debounce). Pendant ce laps de
 * temps, la feuille de style (`src/index.css`) gèle toutes les transitions et
 * animations — ce qui supprime le « layout thrashing ».
 *
 * Aucun calcul lourd (mesure DOM, recalcul de dimensions, React `setState`)
 * n'est exécuté dans l'écouteur : uniquement une écriture de classe class.
 */

/** Délai de stabilisation après le dernier événement `resize` (en ms). */
export const RESIZE_SETTLE_DELAY_MS = 150;

/** Classe posée sur `<body>` pendant toute la durée du redimensionnement. */
export const RESIZING_CLASS = "is-resizing";

let installed = false;
let settleTimer: number | undefined;

/** Annule le temporisateur en cours et libère immédiatement les transitions. */
const release = (): void => {
  if (settleTimer !== undefined) {
    window.clearTimeout(settleTimer);
    settleTimer = undefined;
  }
  document.body.classList.remove(RESIZING_CLASS);
};

/** Écouteur `resize` : gèle les transitions puis les libère après stabilisation. */
const handleResize = (): void => {
  document.body.classList.add(RESIZING_CLASS);
  if (settleTimer !== undefined) {
    window.clearTimeout(settleTimer);
  }
  settleTimer = window.setTimeout(() => {
    settleTimer = undefined;
    document.body.classList.remove(RESIZING_CLASS);
  }, RESIZE_SETTLE_DELAY_MS);
};

/**
 * Installe la garde de redimensionnement (idempotent : les appels multiples
 * sont ignorés). Retourne une fonction de désinstallation qui retire
 * l'écouteur et libère l'état de gel en cours.
 */
export const installWindowResizeGuard = (): (() => void) => {
  if (installed) {
    return () => {};
  }
  installed = true;
  window.addEventListener("resize", handleResize, { passive: true });

  return () => {
    window.removeEventListener("resize", handleResize);
    release();
    installed = false;
  };
};
