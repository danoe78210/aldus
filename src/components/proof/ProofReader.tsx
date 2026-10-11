import React from "react";
import { SEVERITY_COLOR, type TypographyAnalysis } from "../../utils/typographyEngine";
import type { ProofLine } from "../../utils/proofLayout";

interface ProofReaderProps {
  /** Texte brut du chapitre (source des décorations en surlignage). */
  text: string;
  /** Rapport d'analyse typographique (Feuillet VII — moteur aldin). */
  report: TypographyAnalysis;
  /** Lignes du feuillet courant (gabarit vélin). */
  currentLines: ProofLine[];
  /** Anomalie survolée (voile doré discret). */
  hovered: string | null;
  /** Anomalie en train de s'imprimer à l'encre (animation, facultatif). */
  inked?: string | null;
  /** Notifie le survol d'une anomalie depuis le feuillet. */
  onHover: (id: string | null) => void;
}

/**
 * **Grand feuillet de lecture du Banc d'Épreuve** (Feuillet VIII, page gauche
 * du livre) : papier/vélin chaud `#f4efe6`, encre `#1e1913`, Garamond 16 px
 * aéré, justification pleine et alinéa de premier rang. Les anomalies y sont
 * soulignées à l'encre — ondulé carmin (critiques) / pointillé or (style) —
 * et se révèlent au survol par un léger voile doré.
 */
export const ProofReader: React.FC<ProofReaderProps> = ({
  text,
  report,
  currentLines,
  hovered,
  inked = null,
  onHover,
}) => (
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
            nodes.push(
              <mark
                key={anomaly.id}
                onMouseEnter={() => onHover(anomaly.id)}
                onMouseLeave={() => onHover(null)}
                className={inked === anomaly.id ? "animate-ink-reveal" : undefined}
                style={{
                  textDecoration: "underline",
                  textDecorationStyle: anomaly.severity === "critical" ? "wavy" : "dotted",
                  textDecorationColor: SEVERITY_COLOR[anomaly.severity],
                  backgroundColor: active ? "rgba(212,175,55,0.25)" : "transparent",
                }}
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
);