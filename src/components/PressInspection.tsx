import React, { useMemo } from "react";
import { Check, FolderOpen, ShieldAlert, ShieldCheck } from "lucide-react";
import { useStudio } from "./StudioContext";
import { EXPORT_FORMS, pressChecklist } from "../utils/exportEngine";
import { coverMetrics, trimToMm } from "../data/coverMetrics";
import { findTrimPreset } from "../data/trimSizes";
import { misplacedChapters, placeChapters, sheetsOf } from "../data/imposition";
import { analyzeTypography } from "../utils/typographyEngine";

/** Panneau de cartouche du registre de presse. */
const Cartouche: React.FC<{ index: number; title: string; children: React.ReactNode }> = ({
  index,
  title,
  children,
}) => (
  <section className="mb-4 border border-[#3a3022]/70 bg-[#13110f]/60 p-3.5">
    <h3 className="mb-3 flex items-center gap-2 border-b border-[#3a3022] pb-2 font-serif text-[11px] tracking-widest text-[#d4af37] uppercase">
      <span className="text-[#8f6e2b]">[{index}]</span>
      {title}
    </h3>
    {children}
  </section>
);

/**
 * **Feuillet IX — Inspection Pré-Presse & Formes** (page de gauche de l'onglet
 * Export) : choix des formes d'édition, **bilan d'intégrité KDP** calculé sur
 * l'état réel du projet, dossier de fabrication et jauge d'encrage.
 *
 * L'ordre de tirage se donne au marbre de pressage (Feuillet X).
 */
export const PressInspection: React.FC = () => {
  const {
    exportForms,
    onToggleExportForm,
    exportDirectory,
    onPickExportDirectory,
    cover,
    manuscriptConfig,
    bookInfo,
    structure,
    isPressing,
  } = useStudio();

  const trim = findTrimPreset(manuscriptConfig.trimSize);
  const trimWidthMm = trim ? trimToMm(trim.width, trim.unit) : 152.4;
  const trimHeightMm = trim ? trimToMm(trim.height, trim.unit) : 228.6;
  const pages = Math.max(1, cover.pageCount);
  const metrics = coverMetrics(trimWidthMm, trimHeightMm, pages, cover.paperType);

  /** Mentions composées soumises à l'examen typographique (couverture + titre). */
  const composedText = [cover.spineText, bookInfo.title, bookInfo.subtitle, bookInfo.author]
    .filter(Boolean)
    .join("\n");
  const typographyReport = useMemo(() => analyzeTypography(composedText), [composedText]);

  const checklist = useMemo(
    () =>
      pressChecklist({
        pageCount: pages,
        spineText: cover.spineText,
        spineWidthMm: metrics.spineWidthMm,
        misplaced: misplacedChapters(placeChapters(structure, pages)),
        typographyIssues: typographyReport.total,
      }),
    [pages, cover.spineText, metrics.spineWidthMm, structure, typographyReport.total],
  );

  const ready = checklist.every((item) => item.ok);
  const selectedCount = EXPORT_FORMS.filter((form) => exportForms[form.id]).length;

  return (
    <div className="animate-ink-reveal mx-auto flex h-full w-full max-w-2xl flex-col overflow-y-auto proof-scroll-dark px-2 pr-1">
      <h2 className="mb-6 text-center font-serif text-lg tracking-[0.25em] text-[#d4af37] uppercase">
        IX. Inspection Pré-Presse &amp; Formes
      </h2>

      {/* [1] Dossier de fabrication — destination des archives (définie en premier) */}
      <Cartouche index={1} title="Dossier de fabrication">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate rounded-xs border border-[#3a3022] bg-[#0f0c0a] px-3 py-2 font-mono text-[11px] text-[#bda888]">
            {exportDirectory ?? "Aucun dossier retenu pour les archives"}
          </span>
          <button
            type="button"
            onClick={onPickExportDirectory}
            className="shrink-0 rounded-xs border border-[#997728]/50 bg-linear-to-b from-[#2e1d0f] to-[#170f07] px-3 py-2 font-serif text-[10px] tracking-widest text-[#eedcb8] uppercase transition-colors hover:border-[#ffd700] hover:text-[#ffd700]"
          >
            [ <FolderOpen size={12} className="mr-1 inline" /> | Parcourir les archives ]
          </button>
        </div>
      </Cartouche>

      <Cartouche index={2} title="Formes d'édition">
        <ul className="flex flex-col gap-2.5">
          {EXPORT_FORMS.map((form) => {
            const checked = exportForms[form.id];
            return (
              <li key={form.id}>
                <label
                  className={`flex cursor-pointer items-start gap-2.5 rounded-xs border px-3.5 py-2.5 transition-colors ${
                    checked
                      ? "border-[#8f6e2b]/70 bg-[#1c1814]"
                      : "border-[#3a3022] bg-[#13110f] hover:border-[#8f6e2b]/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleExportForm(form.id)}
                    className="mt-0.5 h-3.5 w-3.5 accent-[#d4af37]"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block font-serif text-sm ${
                        checked ? "text-[#ffd700]" : "text-[#c9bea9]"
                      }`}
                    >
                      {form.label}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] text-[#9e9587]">
                      {form.engine}
                    </span>
                    <ul className="mt-0.5 space-y-0.5">
                      {form.bullets.map((bullet) => (
                        <li key={bullet} className="font-serif text-[11px] italic leading-snug text-[#786c59]">
                          — {bullet}
                        </li>
                      ))}
                    </ul>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </Cartouche>
<Cartouche index={3} title="Bilan d'intégrité KDP">
        <ul className="space-y-2">
          {checklist.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              {item.ok ? (
                <Check size={14} className="mt-0.5 shrink-0 text-[#c5a059]" strokeWidth={2.5} />
              ) : (
                <ShieldAlert size={14} className="mt-0.5 shrink-0 text-[#a83232]" />
              )}
              <span className="min-w-0">
                <span
                  className={`block font-serif text-xs ${
                    item.ok ? "text-[#f5efe4]" : "text-[#a83232]"
                  }`}
                >
                  {item.label}
                </span>
                <span className="block font-mono text-[10px] text-[#9e9587]">{item.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Cartouche>

      {/* [4] Jauge d'encrage & de massicotage */}
      <section className="mb-2 border border-[#3a3022]/70 bg-[#13110f]/60 p-3.5">
        <h3 className="mb-3 flex items-center gap-2 border-b border-[#3a3022] pb-2 font-serif text-[11px] tracking-widest text-[#d4af37] uppercase">
          <span className="text-[#8f6e2b]">[4]</span>
          Jauge d&rsquo;encrage &amp; de massicotage
        </h3>
        <div className="flex items-center gap-3">
          {ready ? (
            <ShieldCheck size={16} className="shrink-0 text-[#c5a059]" />
          ) : (
            <ShieldAlert size={16} className="shrink-0 text-[#a83232]" />
          )}
          <span className="font-serif text-xs text-[#c9bea9]">
            {ready ? "Forme prête" : "Forme en attente de correction"}
          </span>
          <span className="ml-auto font-mono text-[10px] text-[#9e9587]">
            {selectedCount} forme{selectedCount > 1 ? "s" : ""} · {pages} pages ·{" "}
            {sheetsOf(pages)} feuillets
          </span>
        </div>
        <div className="mt-3 h-3 w-full overflow-hidden rounded-xs border border-[#2e261b] bg-[#1c1814]">
          <div
            className={`h-full bg-linear-to-r from-[#8f6e2b] via-[#c5a059] to-[#8f6e2b] transition-all duration-500 ${
              isPressing ? "animate-pulse" : ""
            }`}
            style={{
              width: `${Math.round(
                (checklist.filter((item) => item.ok).length / checklist.length) * 100,
              )}%`,
            }}
          />
        </div>
        <p className="mt-1 font-serif text-[10px] italic text-[#786c59]">
          L&rsquo;ordre de tirage se donne au marbre de pressage (Feuillet X).
        </p>
      </section>
    </div>
  );
};