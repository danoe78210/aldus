import React, { useMemo } from "react";
import { FolderOpen, Loader2, Stamp } from "lucide-react";
import { useStudio } from "./StudioContext";
import { PressSealAnimation } from "./export/PressSealAnimation";
import { PRESS_STAGES, buildColophon, todayInFrench } from "../utils/exportEngine";
import { findTrimPreset } from "../data/trimSizes";
import { sheetsOf } from "../data/imposition";

/**
 * **Feuillet X — Le Tirage sous Presse** (page de droite de l'onglet Export) :
 * marbre de pressage sous fer (gravure de la presse d'Alde Manuce), colophon
 * d'achevé d'imprimer composé dynamiquement, et l'action cérémonielle
 * `[ Actionner la Presse & Tirer le Volume › ]` avec sa cinématique en trois
 * étapes cadencées (~3,5 s) — pilotée par `App.tsx` (`onPress`, `pressStage`).
 */
export const PressWorkshop: React.FC = () => {
  const {
    pressStage,
    isPressing,
    pressDone,
    onPress,
    onOpenExportDirectory,
    onPreview,
    exportDirectory,
    cover,
    manuscriptConfig,
    bookInfo,
  } = useStudio();

  const trim = findTrimPreset(manuscriptConfig.trimSize);
  const pages = Math.max(1, cover.pageCount);
  const colophon = useMemo(
    () =>
      buildColophon({
        author: bookInfo.author,
        date: todayInFrench(),
        trimLabel: trim ? trim.label : manuscriptConfig.trimSize,
        pages,
      }),
    [bookInfo.author, trim, manuscriptConfig.trimSize, pages],
  );

  return (
    <div className="animate-ink-reveal mx-auto flex h-full w-full max-w-2xl flex-col overflow-y-auto px-2 pr-1">
      <h2 className="mb-6 text-center font-serif text-lg tracking-[0.25em] text-[#d4af37] uppercase">
        X. Le Tirage sous Presse
      </h2>

      {/* Marbre de pressage sous fer */}
      <div className="mb-6 border-2 border-[#382f22] bg-[#141210] p-6 text-center">
        {isPressing && pressStage >= 0 ? (
          <div className="py-6">
            <Loader2 size={22} className="mx-auto animate-spin text-[#c5a059]" />
            <p className="mt-3 font-serif text-sm text-[#eedcb8]">
              {PRESS_STAGES[pressStage]?.label ?? "Pressage en cours…"}
            </p>
            {/* Trois étapes cadencées */}
            <ol className="mx-auto mt-4 flex max-w-md items-center gap-2">
              {PRESS_STAGES.map((stage, index) => (
                <li key={stage.label} className="flex-1">
                  <span
                    className={`block h-1.5 rounded-xs transition-colors duration-300 ${
                      index <= pressStage
                        ? "bg-linear-to-r from-[#8f6e2b] via-[#c5a059] to-[#8f6e2b]"
                        : "bg-[#2e261b]"
                    }`}
                  />
                  <span className="mt-1 block font-mono text-[9px] text-[#786c59]">
                    {index + 1}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <>
            {/* Gravure de la presse humaniste */}
            <svg
              viewBox="0 0 240 120"
              role="img"
              aria-label="Gravure de la presse d'Alde Manuce"
              className="mx-auto h-28 w-auto"
            >
              <g fill="none" stroke="#8f6e2b" strokeWidth="1.2">
                <rect x="16" y="86" width="208" height="10" />
                <path d="M32 86 L32 30 M208 86 L208 30 M32 34 L208 34" />
                <path d="M120 34 L120 52" />
                <circle cx="120" cy="62" r="9" />
                <path d="M60 86 L60 66 M180 86 L180 66 M60 66 L180 66" />
                <path d="M96 52 L144 52 L144 66 L96 66 Z" />
              </g>
              <text
                x="120"
                y="26"
                textAnchor="middle"
                fontFamily="Cormorant Garamond, Georgia, serif"
                fontSize="11"
                letterSpacing="3"
                fill="#c5a059"
              >
                ALDE MANVCE
              </text>
              <text
                x="120"
                y="112"
                textAnchor="middle"
                fontFamily="Cormorant Garamond, Georgia, serif"
                fontSize="9"
                letterSpacing="4"
                fill="#8f6e2b"
              >
                VENETIA · MDI
              </text>
            </svg>

            {/* Colophon d'achevé d'imprimer */}
            <p className="mx-auto mt-4 max-w-md font-serif text-[12px] leading-relaxed text-[#bda888] italic">
              «&nbsp;{colophon}&nbsp;»
            </p>
            <p className="mt-2 font-mono text-[10px] text-[#786c59]">
              {pages} pages · {sheetsOf(pages)} feuillets
              {exportDirectory ? ` · archives : ${exportDirectory.split(/[\\/]/).pop()}` : ""}
            </p>
          </>
        )}
      </div>
{/* Action cérémonielle de tirage */}
      <button
        type="button"
        onClick={onPress}
        disabled={isPressing}
        className="w-full border border-[#997728]/70 bg-linear-to-b from-[#2e1d0f] to-[#170f07] py-4 font-serif text-xs tracking-[0.28em] text-[#eedcb8] uppercase shadow-2xl transition-all duration-300 hover:border-[#ffd700] hover:text-[#ffd700] hover:shadow-[0_0_24px_rgba(212,175,55,0.3)] active:scale-[0.99] disabled:opacity-50"
      >
        [ Actionner la Presse &amp; Tirer le Volume &rsaquo; ]
      </button>

      <button
        type="button"
        onClick={onOpenExportDirectory}
        disabled={isPressing}
        className="mt-3 w-full rounded-xs border border-[#382f22] bg-[#141210] py-2.5 font-cinzel text-xs uppercase tracking-widest text-[#c9bea9] hover:border-[#8f6e2b] hover:text-[#d4af37] flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-40"
      >
        <FolderOpen size={15} className="shrink-0" />
        [ OUVRIR LE DOSSIER DES ÉPREUVES ]
      </button>

      <button
        type="button"
        onClick={onPreview}
        disabled={isPressing}
        className="mt-2 w-full border border-[#2a2c33] py-2.5 font-serif text-[11px] tracking-widest text-[#9e9587] uppercase transition-colors hover:border-[#8f6e2b] hover:text-[#c5a059] disabled:opacity-40"
      >
        [ Feuilleter le volume composé ]
      </button>

      <p className="mt-4 flex items-start gap-2 border-t border-dotted border-[#5a4f3f] pt-3 font-serif text-[11px] italic text-[#786c59]">
        <Stamp size={12} className="mt-0.5 shrink-0 text-[#8f6e2b]" />
        Le tirage consigne chaque forme dans les archives et referme le cycle de
        fabrication : inspection (Feuillet IX) puis pressage, sans jamais modifier le
        manuscrit vérifié.
      </p>

      {/* Achèvement du tirage — estampe en veilleuse / presse / sceau frappé */}
      <PressSealAnimation
        status={isPressing ? "pressing" : pressDone ? "completed" : "idle"}
      />
    </div>
  );
};