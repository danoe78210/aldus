import { describe, expect, it } from "vitest";
import {
  NBSP,
  NNBSP,
  analyzeTypography,
  applyAldineUsage,
} from "../typography";

describe("usage aldin — analyse typographique", () => {
  it("signale les espaces insécables manquantes avant les ponctuations hautes", () => {
    const report = analyzeTypography("Il entra : la porte claqua !");
    const rule = report.issues.find((issue) => issue.rule === "nbsp-high-punctuation");
    expect(rule?.count).toBe(2);
    expect(rule?.fixable).toBe(true);
  });

  it("ne signale rien lorsque les insécables sont déjà posées", () => {
    const report = analyzeTypography(`Il entra${NBSP}: la porte claqua${NBSP}!`);
    expect(report.issues.find((issue) => issue.rule === "nbsp-high-punctuation")).toBeUndefined();
  });

  it("détecte les incises en trait d'union court (cadratin attendu)", () => {
    const report = analyzeTypography("Venise - la Sérénissime - dormait.");
    expect(report.issues.find((issue) => issue.rule === "em-dash")?.count).toBe(2);
  });

  it("détecte les doubles espaces et les blancs de tête", () => {
    const report = analyzeTypography("Deux  espaces\n   et un retrait.");
    expect(report.issues.find((issue) => issue.rule === "double-space")?.count).toBe(2);
  });

  it("détecte les guillemets français mal insécables", () => {
    const report = analyzeTypography("Il dit « bonjour » à tous.");
    expect(report.issues.find((issue) => issue.rule === "nbsp-guillemets")?.count).toBe(2);
  });

  it("détecte les césures orphelines et les lignes veuves (non corrigeables)", () => {
    const report = analyzeTypography("Une césu-\nre maladroite.\n\nUn long paragraphe\nqui finit par\nun\n");
    const hyphen = report.issues.find((issue) => issue.rule === "orphan-hyphen");
    expect(hyphen?.count).toBe(1);
    expect(hyphen?.fixable).toBe(false);
    expect(report.issues.find((issue) => issue.rule === "widow-word")?.count).toBe(1);
  });

  it("compte les mots (hors ponctuation isolée) et agrège le total", () => {
    const report = analyzeTypography("Bonjour  le monde : ici !");
    expect(report.words).toBe(4);
    expect(report.total).toBeGreaterThan(0);
  });
});

describe("usage aldin — application automatique", () => {
  it("pose les insécables, cadratins et espaces uniques", () => {
    const result = applyAldineUsage("Venise - la ville - dormait :  silence !");
    expect(result.text).toBe(
      `Venise${NNBSP}\u2014${NNBSP}la ville${NNBSP}\u2014${NNBSP}dormait${NBSP}: silence${NBSP}!`,
    );
    expect(result.applied).toBeGreaterThan(0);
  });

  it("colle les guillemets français", () => {
    const result = applyAldineUsage("« Bonjour »");
    expect(result.text).toBe(`«${NBSP}Bonjour${NBSP}»`);
  });

  it("est idempotent sur un texte déjà conforme", () => {
    const clean = applyAldineUsage("Venise - la ville - dormait :  silence !").text;
    const second = applyAldineUsage(clean);
    expect(second.text).toBe(clean);
    expect(second.applied).toBe(0);
  });

  it("ne touche ni aux césures ni aux veuves", () => {
    const source = "Une césu-\nre maladroite.\n\nfin\n";
    expect(applyAldineUsage(source).text).toBe(source);
  });
});