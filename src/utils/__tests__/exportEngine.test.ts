import { describe, expect, it } from "vitest";
import {
  EXPORT_FORMS,
  PRESS_STAGES,
  PRESS_TOTAL_MS,
  buildColophon,
  pressChecklist,
  pressStageAt,
  todayInFrench,
} from "../exportEngine";
import type { ChapterPlacement } from "../../data/imposition";

const placement = (title: string, startPage: number): ChapterPlacement => ({
  id: title,
  title,
  startPage,
  recto: startPage % 2 === 1,
});

describe("presse — formes d'édition", () => {
  it("propose les quatre formes du cycle de fabrication", () => {
    expect(EXPORT_FORMS.map((form) => form.id)).toEqual([
      "pdf-x",
      "epub32",
      "cover-300",
      "docx-x",
    ]);
    EXPORT_FORMS.forEach((form) => {
      expect(form.bullets.length).toBeGreaterThan(0);
      expect(form.handler).not.toBe("");
    });
  });

  it("does not present unaudited format certifications as guarantees", () => {
    expect(EXPORT_FORMS[0].label).toBe("PDF Imprimeur (Haute Définition)");
    expect(EXPORT_FORMS[1].label).toBe("EPUB (Standard)");
    expect(EXPORT_FORMS.every((form) => !/PDF\/X|3\.2/i.test(form.label))).toBe(true);
    expect(EXPORT_FORMS[0].tooltip).toContain("aucune certification");
    expect(EXPORT_FORMS[1].tooltip).toContain("sans validation EPUBCheck");
  });
});

describe("presse — bilan d'intégrité KDP", () => {
  const base = {
    pageCount: 124,
    spineText: "Nunael — Danoë",
    spineWidthMm: 7.87,
    misplaced: [],
    typographyIssues: 0,
  };

  it("atteste les quatre indicateurs lorsque tout est conforme", () => {
    const items = pressChecklist(base);
    expect(items).toHaveLength(4);
    expect(items.every((item) => item.ok)).toBe(true);
  });

  it("signale une pagination non multiple de 4", () => {
    const items = pressChecklist({ ...base, pageCount: 123 });
    expect(items.find((item) => item.id === "imposition")?.ok).toBe(false);
  });

  it("signale un dos trop étroit ou un texte de dos sous 80 pages", () => {
    expect(pressChecklist({ ...base, spineWidthMm: 2 }).find((i) => i.id === "spine")?.ok).toBe(false);
    expect(
      pressChecklist({ ...base, pageCount: 60, spineText: "Texte" }).find((i) => i.id === "spine")
        ?.ok,
    ).toBe(false);
  });

  it("signale les chapitres mal calés et les irrégularités typographiques", () => {
    const items = pressChecklist({
      ...base,
      misplaced: [placement("Deux", 36)],
      typographyIssues: 3,
    });
    expect(items.find((item) => item.id === "belles-pages")?.ok).toBe(false);
    expect(items.find((item) => item.id === "typography")?.ok).toBe(false);
  });
});

describe("presse — colophon & cinématique", () => {
  it("compose le colophon d'achevé d'imprimer", () => {
    const colophon = buildColophon({
      author: "Danoë",
      date: "10 octobre 2026",
      trimLabel: "6 × 9 po",
      pages: 124,
    });
    expect(colophon).toContain("Officine d'Aldus");
    expect(colophon).toContain("Danoë");
    expect(colophon).toContain("10 octobre 2026");
    expect(colophon).toContain("6 × 9 po");
    expect(colophon).toContain("62 feuillets sous fer");
  });

  it("retombe sur « l'auteur » sans nom", () => {
    expect(
      buildColophon({ author: "", date: "1 janvier 2026", trimLabel: "A4", pages: 24 }),
    ).toContain("pour le compte de l'auteur");
  });

  it("cadence le pressage en trois étapes de 3,5 s", () => {
    expect(PRESS_STAGES).toHaveLength(3);
    expect(PRESS_TOTAL_MS).toBe(3500);
    expect(pressStageAt(0)).toBe(0);
    expect(pressStageAt(1199)).toBe(0);
    expect(pressStageAt(1200)).toBe(1);
    expect(pressStageAt(2400)).toBe(2);
    expect(pressStageAt(3500)).toBe(-1);
  });

  it("date le colophon en français", () => {
    expect(todayInFrench(new Date("2026-10-10T12:00:00"))).toBe("10 octobre 2026");
  });
});