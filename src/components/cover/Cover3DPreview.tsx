import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { convertFileSrc } from "@tauri-apps/api/core";

/** Propriétés de la scène 3D (rendu pur). */
export interface Cover3DSceneProps {
  trimWidthMm: number;
  trimHeightMm: number;
  spineWidthMm: number;
  spineText: string;
  spineColor: string | null;
  spineColorAlt: string | null;
  useGradient: boolean;
  spineTextEligible: boolean;
  /** Chemin du plat 1 (Recto) — appliqué comme texture si présent. */
  frontPath: string | null;
  /** Chemin du plat 4 (Verso) — appliqué comme texture si présent. */
  backPath: string | null;
  /** Hauteur d'affichage cible (px) — 240 par défaut, ~600 en immersion. */
  heightPx?: number;
}

/** Propriétés de la page « Volume 3D » (scène + navigation + export). */
export interface Cover3DPreviewProps extends Cover3DSceneProps {
  onBack: () => void;
  /** Fermeture de la vitrine immersive → retour à l'onglet « settings ». */
  onBackToSettings: () => void;
  onExport: () => void;
  canExport: boolean;
  busy: boolean;
}

/**
 * Convertit un chemin de fichier local en URL chargeable par la WebView
 * (`asset://`). Renvoie `null` hors Tauri (où l'API n'est pas injectée).
 */
const toAssetUrl = (path: string | null): string | null => {
  if (!path) {
    return null;
  }
  try {
    return convertFileSrc(path);
  } catch {
    return null;
  }
};

/** Texture de cuir par défaut (repli sans image). */
const LEATHER = "linear-gradient(135deg, #6b4423 0%, #4a2c15 55%, #2e1a0c 100%)";

/** Borne une valeur dans un intervalle. */
const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

/** Hauteur cible du livre à l'écran (px) — sert d'échelle mm → px. */
const TARGET_HEIGHT_PX = 240;

/**
 * Aperçu 3D interactif du livre fermé (CSS 3D pur) : Plat 1, tranche et
 * tranche des pages, avec contrôle orbital à la souris.
 */
const Book3D: React.FC<Cover3DSceneProps> = ({
  trimWidthMm,
  trimHeightMm,
  spineWidthMm,
  spineText,
  spineColor,
  spineColorAlt,
  useGradient,
  spineTextEligible,
  frontPath,
  backPath,
  heightPx,
}) => {
  const [rotH, setRotH] = useState(-28);
  const [rotV, setRotV] = useState(-6);
  const drag = useRef<{ x: number; y: number } | null>(null);
  /** `true` pendant le glissement — état exposé au rendu (jamais de ref lue au rendu). */
  const [dragging, setDragging] = useState(false);

  const scale = (heightPx ?? TARGET_HEIGHT_PX) / Math.max(trimHeightMm, 1);
  const w = trimWidthMm * scale;
  const h = trimHeightMm * scale;
  const depth = Math.max(spineWidthMm * scale, 8);

  const frontUrl = toAssetUrl(frontPath);
  const backUrl = toAssetUrl(backPath);

  const spineBg =
    useGradient && spineColor && spineColorAlt
      ? `linear-gradient(90deg, ${spineColor}, ${spineColorAlt})`
      : spineColor ?? "#1c140e";

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    drag.current = { x: event.clientX, y: event.clientY };
    setRotH((value) => clamp(value + dx * 0.4, -180, 180));
    setRotV((value) => clamp(value - dy * 0.4, -15, 15));
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    drag.current = null;
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  /** Feuille de style commune d'une face centrée (méthode cuboïde). */
  const face = (fw: number, fh: number, transform: string): React.CSSProperties => ({
    position: "absolute",
    left: "50%",
    top: "50%",
    width: fw,
    height: fh,
    marginLeft: -fw / 2,
    marginTop: -fh / 2,
    transform,
    backfaceVisibility: "hidden",
  });

  return (
    <div
      className="flex h-full w-full cursor-grab touch-none items-center justify-center active:cursor-grabbing"
      style={{ perspective: "1100px" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <div
        style={{
          position: "relative",
          width: w,
          height: h,
          transformStyle: "preserve-3d",
          transform: `rotateX(${rotV}deg) rotateY(${rotH}deg)`,
          transition: dragging ? "none" : "transform 120ms ease-out",
        }}
      >
        {/* Plat 1 (couverture) — texture réelle ou cuir par défaut */}
        <div
          data-testid="cover-3d-front-face"
          style={{
            ...face(w, h, `translateZ(${depth / 2}px)`),
            backgroundImage: frontUrl ? `url(${frontUrl})` : LEATHER,
            backgroundSize: "cover",
            backgroundPosition: "center",
            boxShadow: "inset 0 0 40px rgba(0,0,0,0.45)",
            borderRadius: "2px 4px 4px 2px",
          }}
        >
          {/* Éclairage d'ambiance */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(circle at 30% 20%, rgba(255,220,150,0.28) 0%, transparent 55%)",
            }}
          />
          {!frontUrl && (
            <div
              style={{
                position: "absolute",
                inset: 12,
                border: "1px solid rgba(206,161,90,0.45)",
                borderRadius: "2px",
              }}
            />
          )}
        </div>

        {/* Plat 4 (Verso) — texture réelle ou cuir par défaut */}
        <div
          data-testid="cover-3d-back-face"
          style={{
            ...face(w, h, `rotateY(180deg) translateZ(${depth / 2}px)`),
            backgroundImage: backUrl ? `url(${backUrl})` : LEATHER,
            backgroundSize: "cover",
            backgroundPosition: "center",
            boxShadow: "inset 0 0 40px rgba(0,0,0,0.45)",
            borderRadius: "4px 2px 2px 4px",
          }}
        />

        {/* Tranche (dos) */}
        <div
          style={{
            ...face(depth, h, `rotateY(-90deg) translateZ(${w / 2}px)`),
            background: spineBg,
            boxShadow: "inset 0 0 24px rgba(0,0,0,0.55)",
          }}
        >
          {spineTextEligible && spineText.trim() !== "" && (
            <div className="flex h-full w-full items-center justify-center overflow-hidden">
              <span
                style={{
                  transform: "rotate(-90deg)",
                  whiteSpace: "nowrap",
                  color: "#ffffff",
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: 12,
                  letterSpacing: "0.12em",
                  textShadow: "0 1px 1px rgba(0,0,0,0.5)",
                }}
              >
                {spineText}
              </span>
            </div>
          )}
        </div>

        {/* Tranche des pages (papier ivoire, texture de feuillets) */}
        <div
          style={{
            ...face(depth, h, `rotateY(90deg) translateZ(${w / 2}px)`),
            background:
              "repeating-linear-gradient(0deg, #efe6d2 0px, #efe6d2 1px, #ddd2b6 2px, #efe6d2 3px)",
            boxShadow: "inset 0 0 20px rgba(0,0,0,0.3)",
          }}
        />
      </div>

      {/* Ombre portée douce au sol */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          bottom: "6%",
          width: w * 1.1,
          height: h * 0.12,
          background: "radial-gradient(ellipse, rgba(0,0,0,0.45) 0%, transparent 70%)",
          filter: "blur(8px)",
        }}
      />
    </div>
  );
};

/**
 * Page « Volume 3D » : vitrine spacieuse du livre fermé + vue immersive plein
 * écran (théâtre) et pied de navigation/export.
 */
export const Cover3DPreview: React.FC<Cover3DPreviewProps> = (props) => {
  const { onBack, onBackToSettings, onExport, canExport, busy, ...scene } = props;
  const [immersive, setImmersive] = useState(false);

  // Fermeture de la vitrine immersive (Échap) + retour à l'onglet « settings ».
  useEffect(() => {
    if (!immersive) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImmersive(false);
        onBackToSettings();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [immersive, onBackToSettings]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-sm border border-brass/30 bg-parchment-dark/40 shadow-[inset_0_0_40px_rgba(0,0,0,0.25)]">
        <Book3D {...scene} />
        <button
          type="button"
          onClick={() => setImmersive(true)}
          className="absolute top-2 right-2 rounded-sm border border-brass/50 bg-linear-to-b from-copper to-[#8a5426] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_4px_rgba(0,0,0,0.5)] transition-all hover:brightness-110 active:translate-y-px"
        >
          [ ⛶ Vue immersive ]
        </button>
      </div>

      <div className="mt-3 flex shrink-0 items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-sm border border-stone-400/50 bg-stone-500/5 px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-stone-600 transition-colors hover:bg-stone-500/10"
        >
          ‹ Planche 2D
        </button>
        <button
          type="button"
          onClick={onExport}
          disabled={!canExport || busy}
          className="rounded-sm border border-brass/50 bg-linear-to-b from-copper to-[#8a5426] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_6px_rgba(0,0,0,0.5)] transition-all hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
        >
          [ {busy ? "Génération…" : "Exporter la couverture KDP (.pdf)"} &rsaquo; ]
        </button>
      </div>

      {/* Vitrine immersive plein écran détachée (portal) — théâtre tamisé */}
      {immersive &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex flex-col bg-stone-950/95 p-6">
            <div className="mb-4 flex items-center justify-between border-b border-stone-400/30 pb-3">
              <span className="font-serif text-lg uppercase tracking-[0.2em] text-parchment">
                Volume 3D — Vue immersive
              </span>
              <button
                type="button"
                onClick={() => {
                  setImmersive(false);
                  onBackToSettings();
                }}
                className="rounded-sm border border-brass/50 bg-linear-to-b from-copper to-[#8a5426] px-4 py-2 font-mono text-[11px] uppercase tracking-widest text-amber-50"
              >
                [ Fermer ✕ ]
              </button>
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-sm bg-[radial-gradient(circle_at_50%_30%,rgba(255,214,150,0.12)_0%,transparent_65%)]">
              <Book3D {...scene} heightPx={600} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};
