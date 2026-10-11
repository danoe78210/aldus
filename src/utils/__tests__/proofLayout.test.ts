import { describe, expect, it } from "vitest";
import {
  LINES_PER_PAGE,
  anomaliesOfFolio,
  buildProofFolio,
  showSpaces,
  splitLines,
} from "../proofLayout";
import { analyzeTypography } from "../typographyEngine";

describe("proofLayout — gabarit du banc d'épreuve (Feuillet VIII)", () => {
  it("numérote les lignes avec leur décalage absolu", () => {
    const lines = splitLines("ab\ncd\ne");
    expect(lines).toEqual([
      { number: 1, text: "ab", offset: 0 },
      { number: 2, text: "cd", offset: 3 },
      { number: 3, text: "e", offset: 6 },
    ]);
  });

  it("découpe le chapitre en feuillets de gabarit fixe", () => {
    const rows: string[] = [];
    for (let index = 0; index < LINES_PER_PAGE * 2 + 2; index += 1) {
      rows.push(`ligne ${index + 1}`);
    }
    const folio = buildProofFolio(rows.join("\n"), 1, false);
    expect(folio.pages).toHaveLength(3);
    expect(folio.visiblePages).toEqual(folio.pages);
    expect(folio.currentLines).toHaveLength(LINES_PER_PAGE);
  });

  it("borne la page demandée dans la pagination valide", () => {
    const rows: string[] = [];
    for (let index = 0; index < LINES_PER_PAGE + 3; index += 1) {
      rows.push(`ligne ${index + 1}`);
    }
    const folio = buildProofFolio(rows.join("\n"), 99, false);
    expect(folio.safePage).toBe(2);
  });

  it("filtre les feuillets sans anomalie (« feuillets à anomalies »)", () => {
    const rows: string[] = [];
    for (let index = 0; index < LINES_PER_PAGE * 2; index += 1) {
      rows.push(index === 0 ? "coeur" : `ligne ${index + 1}`);
    }
    const text = rows.join("\n");
    const anomalies = analyzeTypography(text).anomalies;
    const folio = buildProofFolio(text, 1, true, anomalies);
    expect(folio.visiblePages).toHaveLength(1);
    expect(folio.visiblePages[0][0].text).toBe("coeur");
  });

  it("expose les anomalies du feuillet courant (conseils de l'Imprimeur)", () => {
    const text = "coeur\n";
    const anomalies = analyzeTypography(text).anomalies;
    const folio = buildProofFolio(text, 1, false, anomalies);
    expect(anomaliesOfFolio(anomalies, folio.currentLines)).toEqual(anomalies);
  });

  it("rend les espaces typographiques visibles dans les gloses", () => {
    expect(showSpaces("avant\u00A0:\u202F!")).toBe("avant⍽:⸗!");
  });
});