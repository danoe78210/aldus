import React, { useEffect, useRef, useState } from "react";
import { SEVERITY_COLOR, type TypographyAnalysis } from "../../utils/typographyEngine";
import type { ProofLine } from "../../utils/proofLayout";

interface ProofReaderProps {
  /** Texte brut du chapitre (source des décorations en surlignage). */
  text: string;
  /** Rapport d'analyse typographique (Feuillet IX — moteur aldin). */
  report: TypographyAnalysis;
  /** Lignes du feuillet courant (gabarit vélin). */
  currentLines: ProofLine[];
  /** Anomalie survolée (voile doré discret). */
  hovered: string | null;
  /** Anomalie en train de s'imprimer à l'encre (animation, facultatif). */
  inked?: string | null;
  /** Anomalie ciblée par « Localiser » (surbrillance or vénitien, facultatif). */
  activeAnomalyId?: string | null;
  /** Consigne les retouches du vélin (texte partagé + fichier + analyse relancée). */
  onSave?: (next: string) => Promise<unknown>;
  /** Notifie le survol d'une anomalie depuis le feuillet. */
  onHover: (id: string | null) => void;
}

/**
 * **Grand feuillet de lecture du Banc d'Épreuve** (Feuillet X, page gauche
 * du livre) : papier/vélin chaud `#f4efe6`, encre `#1e1913`, Garamond 16 px
 * aéré, justification pleine et alinéa de premier rang. Les anomalies y sont
 * soulignées à l'encre — ondulé carmin (critiques) / pointillé or (style) —
 * et se révèlent au survol par un léger voile doré.
 *
 * Une **bascule de mode** au sommet du papier propose :
 * * `[ 👁 Épreuve ]` — lecture annotée (surlignages + commande « Localiser ») ;
 * * `[ ✍ Retouche ]` — vélin éditable assisté d'un **réglet** Markdown
 *   (gras, italique, guillemets français, tiret cadratin, espace insécable,
 *   note de bas de page) ; `[ 💾 Consigner ]` ou `Ctrl+S`/`Cmd+S` soumet le
 *   brouillon par `onSave`.
 */
export const ProofReader: React.FC<ProofReaderProps> = ({
  text,
  report,
  currentLines,
  hovered,
  inked = null,
  activeAnomalyId = null,
  onSave,
  onHover,
}) => {
  // Commande « Localiser » : centre la vue sur l'anomalie ciblée (défilement doux).
  useEffect(() => {
    if (!activeAnomalyId) return;
    const target = document.getElementById(`anomaly-target-${activeAnomalyId}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeAnomalyId]);

  // Vélin éditable : brouillon local (`null` = identique au texte partagé).
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Tout changement du texte partagé (chapitre, correctif, retouches consignées)
  // resynchronise le brouillon : l'édition suit l'épreuve.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resynchronisation délibérée du brouillon local quand le texte partagé change
    setDraft(null);
  }, [text]);

  const currentText = draft ?? text;

  /** Réapplique le focus et l'étendue de sélection après mise à jour du brouillon. */
  const restoreFocus = (start: number, end: number) => {
    window.setTimeout(() => {
      const area = textareaRef.current;
      if (!area) {
        return;
      }
      area.focus();
      area.setSelectionRange(start, end);
    }, 0);
  };

  /** Entoure la sélection courante de `before` / `after` sans perdre le focus. */
  const wrapSelection = (before: string, after: string) => {
    const area = textareaRef.current;
    if (!area) {
      return;
    }
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const next = `${currentText.slice(0, start)}${before}${currentText.slice(start, end)}${after}${currentText.slice(end)}`;
    setDraft(next);
    restoreFocus(start + before.length, end + before.length);
  };

  /** Insère `value` à la position du curseur (ou remplace la sélection). */
  const insertText = (value: string) => {
    const area = textareaRef.current;
    if (!area) {
      return;
    }
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const next = `${currentText.slice(0, start)}${value}${currentText.slice(end)}`;
    setDraft(next);
    restoreFocus(start + value.length, start + value.length);
  };

  /** `Ctrl+S` / `Cmd+S` consigne les retouches sans ouvrir la boîte native. */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      void (onSave?.(currentText) ?? Promise.resolve());
    }
  };

  const handleSave = () => void (onSave?.(currentText) ?? Promise.resolve());

  return (
    <div className="flex h-full w-full min-h-0 flex-col">
      {/* Bascule de mode : Épreuve (lecture annotée) / Retouche (vélin éditable) */}
      <div className="mb-2 flex shrink-0 items-center justify-between border-b border-[#382f22] pb-2">
        <span className="font-cinzel text-[11px] uppercase tracking-wider text-[#c9bea9]">
          Feuillet de lecture
        </span>
        <div className="flex shrink-0 items-center rounded-xs border border-[#382f22] bg-[#141210]">
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            aria-pressed={!isEditing}
            className={`flex items-center gap-1.5 border-r border-[#382f22] px-2.5 py-1 font-cinzel text-[11px] uppercase tracking-wider transition-colors ${
              !isEditing
                ? "bg-[#2d2212] text-[#f3e5ab]"
                : "bg-transparent text-[#a89f91] hover:text-[#c5a059]"
            }`}
          >
            <span className="text-xs">👁</span>
            <span>Épreuve</span>
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            aria-pressed={isEditing}
            className={`flex items-center gap-1.5 px-2.5 py-1 font-cinzel text-[11px] uppercase tracking-wider transition-colors ${
              isEditing
                ? "bg-[#2d2212] text-[#f3e5ab]"
                : "bg-transparent text-[#a89f91] hover:text-[#c5a059]"
            }`}
          >
            <span className="text-xs">✍</span>
            <span>Retouche</span>
          </button>
        </div>
      </div>

      {isEditing ? (
        /* ═════ Vélin éditable + réglet d'assistance Markdown ═════ */
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Réglet d'atelier */}
          <div className="flex shrink-0 items-center justify-between rounded-t-sm border-b border-[#382f22] bg-[#1a1612] px-3 py-1.5 font-cinzel text-xs text-[#c9bea9]">
            <div className="flex min-w-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => wrapSelection("**", "**")}
                className="px-2 py-0.5 rounded-xs border border-[#382f22] bg-[#141210] font-bold hover:border-[#8f6e2b] hover:text-[#d4af37]"
                title="Gras (**texte**)"
              >
                B
              </button>
              <button
                type="button"
                onClick={() => wrapSelection("*", "*")}
                className="px-2 py-0.5 rounded-xs border border-[#382f22] bg-[#141210] italic hover:border-[#8f6e2b] hover:text-[#d4af37]"
                title="Italique (*texte*)"
              >
                I
              </button>
              <span className="mx-1 text-[#382f22]">|</span>
              <button
                type="button"
                onClick={() => wrapSelection("«\u00A0", "\u00A0»")}
                className="px-2 py-0.5 rounded-xs border border-[#382f22] bg-[#141210] hover:border-[#8f6e2b] hover:text-[#d4af37]"
                title="Guillemets français avec espaces insécables"
              >
                « »
              </button>
              <button
                type="button"
                onClick={() => insertText("— ")}
                className="px-2 py-0.5 rounded-xs border border-[#382f22] bg-[#141210] hover:border-[#8f6e2b] hover:text-[#d4af37]"
                title="Tiret cadratin d'incise ou de dialogue"
              >
                —
              </button>
              <button
                type="button"
                onClick={() => insertText("\u00A0")}
                className="px-2 py-0.5 rounded-xs border border-[#382f22] bg-[#141210] hover:border-[#8f6e2b] hover:text-[#d4af37]"
                title="Espace insécable (U+00A0)"
              >
                ⎵
              </button>
              <button
                type="button"
                onClick={() => insertText("[^1]")}
                className="px-2 py-0.5 rounded-xs border border-[#382f22] bg-[#141210] hover:border-[#8f6e2b] hover:text-[#d4af37]"
                title="Note de bas de page"
              >
                [^]
              </button>
            </div>
            <button
              type="button"
              onClick={handleSave}
              className="shrink-0 rounded-xs border border-[#8f6e2b] bg-[#221b14] px-3 py-1 text-[11px] uppercase tracking-wider text-[#d4af37] transition-colors hover:bg-[#2d241a] hover:text-[#f3e5ab]"
              title="Consigner les retouches (Ctrl+S)"
            >
              💾 Consigner
            </button>
          </div>

          {/* Surface de retouche sur vélin */}
          <textarea
            ref={textareaRef}
            value={currentText}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            placeholder="Saisissez ou retouchez votre texte ici…"
            className="min-h-0 w-full flex-1 resize-none appearance-none rounded-b-sm bg-[#f4efe6] p-6 font-serif text-[16px] leading-relaxed text-[#1e1913] outline-none selection:bg-[#d4af37]/40 selection:text-[#0e0c0a] proof-scroll-light"
          />
        </div>
      ) : (
        /* ═════ Épreuve : papier vélin annoté ═════ */
        <div className="min-h-0 flex-1 overflow-hidden rounded-xs border border-[#8f6e2b]/40 bg-[#f4efe6] px-8 py-6 shadow-[inset_0_0_30px_rgba(0,0,0,0.12)]">
          <div
            className="mx-auto max-w-[36rem] font-serif text-[16px] leading-7 text-[#1e1913]"
            style={{ textAlign: "justify" }}
          >
            {currentLines.map((line) => {
              const found = report.anomalies.filter((anomaly) => anomaly.line === line.number);
              const firstLineIndent = line.text.trimStart() === line.text ? "1.5em" : 0;
              if (found.length === 0) {
                return (
                  <p key={line.number} className="min-h-[2rem]" style={{ textIndent: firstLineIndent }}>
                    {line.text || "\u00A0"}
                  </p>
                );
              }
              const nodes: React.ReactNode[] = [];
              let cursor = line.offset;
              found
                .slice()
                .sort((left, right) => left.offset - right.offset)
                .forEach((anomaly) => {
                  if (anomaly.offset < cursor || anomaly.offset >= line.offset + line.text.length) {
                    return;
                  }
                  if (cursor < anomaly.offset) {
                    nodes.push(text.slice(cursor, anomaly.offset));
                  }
                  const active = hovered === anomaly.id || inked === anomaly.id;
                  const targeted = activeAnomalyId === anomaly.id;
                  nodes.push(
                    <mark
                      key={anomaly.id}
                      id={`anomaly-target-${anomaly.id}`}
                      onMouseEnter={() => onHover(anomaly.id)}
                      onMouseLeave={() => onHover(null)}
                      className={
                        targeted
                          ? "bg-[#d4af37]/35 text-[#0e0c0a] px-1 py-0.5 rounded-xs ring-2 ring-[#d4af37] shadow-[0_0_12px_rgba(212,175,55,0.5)] font-semibold transition-all duration-300 animate-pulse"
                          : inked === anomaly.id
                            ? "animate-ink-reveal"
                            : undefined
                      }
                      style={
                        targeted
                          ? undefined
                          : {
                              textDecoration: "underline",
                              textDecorationStyle: anomaly.severity === "critical" ? "wavy" : "dotted",
                              textDecorationColor: SEVERITY_COLOR[anomaly.severity],
                              backgroundColor: active ? "rgba(212,175,55,0.25)" : "transparent",
                            }
                      }
                    >
                      {text.slice(anomaly.offset, anomaly.offset + anomaly.length)}
                    </mark>,
                  );
                  cursor = anomaly.offset + anomaly.length;
                });
              if (cursor < line.offset + line.text.length) {
                nodes.push(text.slice(cursor, line.offset + line.text.length));
              }
              return (
                <p key={line.number} className="min-h-[2rem]" style={{ textIndent: firstLineIndent }}>
                  {nodes}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};