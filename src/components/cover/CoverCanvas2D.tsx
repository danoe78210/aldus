import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { CoverGeometry, SpineColorSuggestion } from "../../utils/coverApi";
import {
  BRASS_BUTTON,
  BRASS_BUTTON_EXPORT,
  BRASS_BUTTON_PRIMARY,
} from "./coverButtons";

/** Propriétés de la page « Planche technique 2D ». */
export interface CoverCanvas2DProps {
  geometry: CoverGeometry | null;
  spineText: string;
  suggestion: SpineColorSuggestion | null;
  useGradient: boolean;
  busy: boolean;
  message: string | null;
  canExport: boolean;
  onExport: () => void;
  /** Retour à la page 1 « Réglages & Sources ». */
  onBack: () => void;
  /** Chemin du plat 1 (Recto) — texture réelle sur la planche 2D. */
  frontPath: string | null;
  /** Chemin du plat 4 (Verso) — texture réelle sur la planche 2D. */
  backPath: string | null;
  /** Logo d'éditeur / code-barres ISBN du plat 4 (chemin image), ou `null`. */
  backLogoPath?: string | null;
  /** Ouvre le sélecteur natif de l'illustration de **couverture** (plat 1). */
  onPickFront?: () => void;
  /** Ouvre le sélecteur natif du **logo / code-barres** (plat 4). */
  onPickBackLogo?: () => void;
}

/** Convertit un chemin local en URL `asset://` chargeable par la WebView. */
const assetUrl = (path: string): string => {
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
};

type GuideId = "bleed" | "fold" | "safety" | "barcode";

const TOGGLES: { id: GuideId; label: string; activeClass: string }[] = [
  { id: "bleed", label: "Fond perdu (3,2 mm)", activeClass: "text-[#a83232]" },
  { id: "fold", label: "Lignes de pliure", activeClass: "text-[#4a6b82]" },
  { id: "safety", label: "Zone de sécurité", activeClass: "text-[#8c824a]" },
  { id: "barcode", label: "Réserve code-barres", activeClass: "text-[#d4af37]" },
];

/** Marge de sécurité interne des repères KDP (mm). */
const SAFETY_MM = 6.4;

/**
 * Page 2 : table de montage spacieuse (planche SVG pleine surface), repères KDP
 * commutables, loupe plein écran et export PDF.
 */
export const CoverCanvas2D: React.FC<CoverCanvas2DProps> = ({
  geometry,
  spineText,
  suggestion,
  useGradient,
  busy,
  message,
  canExport,
  onExport,
  onBack,
  frontPath,
  backPath,
  backLogoPath = null,
  onPickFront,
  onPickBackLogo,
}) => {
  const [guides, setGuides] = useState<Record<GuideId, boolean>>({
    bleed: true,
    fold: true,
    safety: true,
    barcode: true,
  });
  const [loupe, setLoupe] = useState(false);

  const toggleGuide = (id: GuideId) =>
    setGuides((previous) => ({ ...previous, [id]: !previous[id] }));

  // Fermeture de la modale plein écran (Échap) + retour à l'onglet « settings ».
  useEffect(() => {
    if (!loupe) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLoupe(false);
        onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loupe, onBack]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Barre d'outils — repères KDP + loupe */}
      <div className="mb-2 flex flex-wrap items-center gap-2 border-b border-stone-400/30 pb-2">
        <span className="font-serif text-xs uppercase tracking-widest text-[#9e9587]">
          Repères
        </span>
        {TOGGLES.map((item) => {
          const active = guides[item.id];
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleGuide(item.id)}
              className={`rounded-xs border px-2 py-1 font-serif text-xs uppercase tracking-widest transition-colors ${
                active
                  ? `border-[#5a4f3f] bg-[#1e1913] ${item.activeClass}`
                  : "border-[#3a3022] bg-transparent text-[#9e9587] hover:border-[#8f6e2b] hover:text-[#c5a059]"
              }`}
            >
              {item.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setLoupe(true)}
          disabled={!geometry}
          className={`ml-auto ${BRASS_BUTTON}`}
        >
          [ ⛶ Plein écran ]
        </button>
      </div>

      {/* Marbre d'épreuve — surface d'ardoise sombre découpée au gabarit KDP.
          Seule cette table porte la grille millimétrique (filigrane laiton),
          jamais le titre ni les commandes supérieures. */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xs border border-[#382f22] bg-[#141210] p-3 shadow-[inset_0_0_30px_rgba(0,0,0,0.6)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg, #382f22 0 1px, transparent 1px 10px), repeating-linear-gradient(90deg, #382f22 0 1px, transparent 1px 10px)",
          }}
        />
        {geometry ? (
          <CoverSvg
            geometry={geometry}
            spineText={spineText}
            suggestion={suggestion}
            useGradient={useGradient}
            guides={guides}
            frontPath={frontPath}
            backPath={backPath}
            backLogoPath={backLogoPath}
            onPickFront={onPickFront}
            onPickBackLogo={onPickBackLogo}
          />
        ) : (
          <p className="font-mono text-[11px] italic text-stone-400">
            Sélectionnez la pagination pour calculer la planche…
          </p>
        )}
      </div>

      {/* Pied de page — navigation + export */}
      <div className="mt-3 flex shrink-0 items-center justify-between gap-3">
        <span
          className="min-w-0 flex-1 truncate text-center font-mono text-[10px] text-[#9e9587]"
          title={message ?? undefined}
        >
          {message}
        </span>
        <button
          type="button"
          onClick={onExport}
          disabled={!canExport || busy}
          className={BRASS_BUTTON_EXPORT}
        >
          [ {busy ? "Génération…" : "Exporter la couverture KDP (.pdf)"} &rsaquo; ]
        </button>
      </div>

      {/* Modale plein écran détachée (portal) — pop-up sombre, Échap pour fermer */}
      {loupe &&
        geometry &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex flex-col bg-stone-950/95 p-6">
            <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-stone-400/30 pb-3">
              <span className="font-serif text-lg uppercase tracking-[0.2em] text-parchment">
                Planche technique KDP — Plein écran
              </span>
              <span className="ml-3 font-serif text-xs uppercase tracking-widest text-[#9e9587]">
                Repères
              </span>
              {TOGGLES.map((item) => {
                const active = guides[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => toggleGuide(item.id)}
                    className={`rounded-xs border px-2 py-1 font-serif text-xs uppercase tracking-widest transition-colors ${
                      active
                        ? `border-[#5a4f3f] bg-[#1e1913] ${item.activeClass}`
                        : "border-[#3a3022] bg-transparent text-[#9e9587] hover:border-[#8f6e2b] hover:text-[#c5a059]"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  setLoupe(false);
                  onBack();
                }}
                className={`ml-auto ${BRASS_BUTTON_PRIMARY}`}
              >
                [ Fermer ✕ ]
              </button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center">
              <div className="h-[90vh] w-[95vw]">
                <CoverSvg
                  geometry={geometry}
                  spineText={spineText}
                  suggestion={suggestion}
                  useGradient={useGradient}
                  guides={guides}
                  frontPath={frontPath}
                  backPath={backPath}
                  backLogoPath={backLogoPath}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

/** Planche SVG vectorielle de la couverture étalée. */
const CoverSvg: React.FC<{
  geometry: CoverGeometry;
  spineText: string;
  suggestion: SpineColorSuggestion | null;
  useGradient: boolean;
  guides: Record<GuideId, boolean>;
  frontPath: string | null;
  backPath: string | null;
  backLogoPath?: string | null;
  onPickFront?: () => void;
  onPickBackLogo?: () => void;
}> = ({
  geometry,
  spineText,
  suggestion,
  useGradient,
  guides,
  frontPath,
  backPath,
  backLogoPath = null,
  onPickFront,
  onPickBackLogo,
}) => {
  const b = geometry.bleedMm;
  const t = geometry.trimWidthMm;
  const w = geometry.totalWidthMm;
  const h = geometry.totalHeightMm;
  const spineW = geometry.spine.widthMm;
  const barcode = geometry.barcode;

  const plat4W = b + t;
  const spineX = b + t;
  const plat1X = b + t + spineW;
  const plat1W = t + b;
  const spineCenterX = spineX + spineW / 2;

  const spineFill =
    useGradient && suggestion ? "url(#spineGrad)" : suggestion?.colorFront ?? "#1c140e";
  const fontSize = Math.max(h * 0.018, 3);
  const guide = 1.4;
  const safetyInset = b + SAFETY_MM;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Planche de couverture KDP"
    >
      <defs>
        <linearGradient id="spineGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={suggestion?.colorFront ?? "#1c140e"} />
          <stop offset="100%" stopColor={suggestion?.colorBack ?? "#1c140e"} />
        </linearGradient>
      </defs>

      {/* Plat 4 (Verso) — texture réelle ou repli beige */}
      {backPath ? (
        <image
          data-testid="cover-svg-back-image"
          href={assetUrl(backPath)}
          x={0}
          y={0}
          width={plat4W}
          height={h}
          preserveAspectRatio="none"
        />
      ) : (
        <rect x={0} y={0} width={plat4W} height={h} fill="#e7e0d2" />
      )}

      {/* Plat 1 (Recto) — texture réelle ou repli beige */}
      {frontPath ? (
        <image
          data-testid="cover-svg-front-image"
          href={assetUrl(frontPath)}
          x={plat1X}
          y={0}
          width={plat1W}
          height={h}
          preserveAspectRatio="none"
        />
      ) : (
        <rect x={plat1X} y={0} width={plat1W} height={h} fill="#e7e0d2" />
      )}

      {/* Tranche (fond uni ou dégradé) */}
      <rect x={spineX} y={0} width={spineW} height={h} fill={spineFill} />

      {/* Contour général */}
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        fill="none"
        stroke="#57534e"
        strokeWidth={guide}
        vectorEffect="non-scaling-stroke"
      />

      {/* Calques de repères KDP (au-dessus des textures, non interactifs) */}
      <g className="pointer-events-none">
      {/* Fond perdu (3,2 mm) — vermillon carmin d'encre ancienne, points fins */}
      {guides.bleed && (
        <rect
          x={b}
          y={b}
          width={Math.max(w - 2 * b, 0)}
          height={Math.max(h - 2 * b, 0)}
          fill="none"
          stroke="#a83232"
          strokeWidth={1}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Lignes de pliure (mors & dos) — bleu de Prusse d'atelier, tirets fins */}
      {guides.fold && (
        <>
          <line
            x1={spineX}
            y1={0}
            x2={spineX}
            y2={h}
            stroke="#4a6b82"
            strokeWidth={1}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={plat1X}
            y1={0}
            x2={plat1X}
            y2={h}
            stroke="#4a6b82"
            strokeWidth={1}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        </>
      )}

      {/* Zone de sécurité KDP — or olive discret, filet continu de 1 px */}
      {guides.safety && (
        <rect
          x={safetyInset}
          y={safetyInset}
          width={Math.max(w - 2 * safetyInset, 0)}
          height={Math.max(h - 2 * safetyInset, 0)}
          fill="none"
          stroke="#8c824a"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Réserve code-barres (coin inférieur droit du plat 4) — parchemin discret */}
      {guides.barcode && (
        <rect
          x={barcode.xMm}
          y={barcode.yMm}
          width={barcode.widthMm}
          height={barcode.heightMm}
          fill="#f4efe6"
          stroke="#5a4f3f"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      )}
      </g>

      {/* Illustration de couverture (plat 1) — encadré pointillé laiton si absente */}
      {!frontPath && (
        <g
          data-testid="cover-svg-front-prompt"
          style={{ cursor: onPickFront ? "pointer" : "default" }}
          onClick={onPickFront}
        >
          <rect
            x={plat1X}
            y={b}
            width={Math.max(t, 0)}
            height={Math.max(h - 2 * b, 0)}
            fill="rgba(212,175,55,0.08)"
            stroke="#d4af37"
            strokeWidth={guide}
            strokeDasharray="8 5"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={plat1X + t / 2}
            y={h / 2}
            fill="#b89355"
            fontSize={fontSize}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            [ + Déposer ou choisir l&rsquo;illustration de couverture ]
          </text>
        </g>
      )}

      {/* Logo d'éditeur / code-barres ISBN (plat 4) — réserve cliquable si absent */}
      {backLogoPath ? (
        <image
          data-testid="cover-svg-logo-image"
          href={assetUrl(backLogoPath)}
          x={barcode.xMm}
          y={barcode.yMm}
          width={barcode.widthMm}
          height={barcode.heightMm}
          preserveAspectRatio="xMidYMid meet"
        />
      ) : (
        <g
          data-testid="cover-svg-logo-prompt"
          style={{ cursor: onPickBackLogo ? "pointer" : "default" }}
          onClick={onPickBackLogo}
        >
          <rect
            x={barcode.xMm}
            y={barcode.yMm}
            width={barcode.widthMm}
            height={barcode.heightMm}
            fill="#f4efe6"
            stroke="#5a4f3f"
            strokeWidth={1}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
          <text
            x={barcode.xMm + barcode.widthMm / 2}
            y={barcode.yMm + barcode.heightMm / 2}
            fill="#5a4f3f"
            fontSize={fontSize * 0.8}
            textAnchor="middle"
            dominantBaseline="middle"
          >
            [ + Logo / code-barres ]
          </text>
        </g>
      )}

      {/* Libellés des plats — bistre chaud discret, dans la marge de fond perdu */}
      <text
        x={plat4W / 2}
        y={b / 2}
        fill="#a89f91"
        fillOpacity={0.75}
        fontSize={Math.max(b * 0.6, 2.2)}
        fontFamily="serif"
        letterSpacing={0.6}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        Plat 4 · Verso
      </text>
      <text
        x={plat1X + plat1W / 2}
        y={b / 2}
        fill="#a89f91"
        fillOpacity={0.75}
        fontSize={Math.max(b * 0.6, 2.2)}
        fontFamily="serif"
        letterSpacing={0.6}
        textAnchor="middle"
        dominantBaseline="middle"
      >
        Plat 1 · Recto
      </text>

      {/* Texte de tranche (tourné à -90°) */}
      {geometry.spine.textEligible && spineText.trim() !== "" && (
        <text
          x={spineCenterX}
          y={h / 2}
          fill="#ffffff"
          fontSize={fontSize}
          textAnchor="middle"
          dominantBaseline="middle"
          transform={`rotate(-90 ${spineCenterX} ${h / 2})`}
        >
          {spineText}
        </text>
      )}
    </svg>
  );
};
