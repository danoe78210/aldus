import { describe, expect, it } from "vitest";
import {
  PAPER_COEFFICIENT_MM,
  misplacedChapters,
  placeChapters,
  planCahiers,
  romanNumeral,
  sheetsOf,
  spineThicknessMm,
} from "../imposition";
import type { StructureItem } from "../../types";

const chapter = (id: string, displayName?: string): StructureItem => ({
  id,
  type: "chapter",
  displayName,
});

describe("imposition — numération romaine du registre", () => {
  it("convertit les rangs en numéraux romains majuscules", () => {
    expect(romanNumeral(1)).toBe("I");
    expect(romanNumeral(4)).toBe("IV");
    expect(romanNumeral(9)).toBe("IX");
    expect(romanNumeral(14)).toBe("XIV");
    expect(romanNumeral(1987)).toBe("MCMLXXXVII");
  });

  it("retombe sur un tiret hors domaine", () => {
    expect(romanNumeral(0)).toBe("—");
    expect(romanNumeral(-3)).toBe("—");
  });
});

describe("imposition — estimation KDP et feuillets", () => {

  it("calcule les feuillets (recto + verso)", () => {
    expect(sheetsOf(1)).toBe(1);
    expect(sheetsOf(84)).toBe(42);
    expect(sheetsOf(85)).toBe(43);
  });

});

describe("imposition — épaisseur de dos et cahiers", () => {
  it("applique Pages × coefficient papier (mm)", () => {
    expect(spineThicknessMm(100, "white")).toBeCloseTo(5.72, 5);
    expect(spineThicknessMm(100, "cream")).toBeCloseTo(6.35, 5);
    expect(spineThicknessMm(100, "color")).toBeCloseTo(5.96, 5);
    expect(PAPER_COEFFICIENT_MM.cream).toBeGreaterThan(PAPER_COEFFICIENT_MM.white);
  });

  it("répartit la pagination en cahiers pleins + reste", () => {
    const plans = planCahiers(100);
    expect(plans).toEqual([
      { size: 16, count: 6, remainder: 4 },
      { size: 20, count: 5, remainder: 0 },
      { size: 24, count: 4, remainder: 4 },
    ]);
  });
});

describe("imposition — détection des belles pages", () => {
  it("place les chapitres après les liminaires et détecte les feuillets pairs", () => {
    const items: StructureItem[] = [
      { id: "act-1", type: "act" },
      chapter("c1", "Ouverture"),
      chapter("c2", "La nuit vénitienne"),
      chapter("c3"),
    ];
    // 84 pages déclarées → corps = 60 pages → 20 pages par chapitre.
    const placements = placeChapters(items, 84);

    expect(placements).toHaveLength(3);
    expect(placements[0]).toMatchObject({ title: "Ouverture", startPage: 25, recto: true });
    expect(placements[1]).toMatchObject({ title: "La nuit vénitienne", startPage: 45, recto: true });
    // Chapitre sans titre : nom de repli généré.
    expect(placements[2].title).toBe("Chapitre 3");
    expect(misplacedChapters(placements)).toHaveLength(0);
  });

  it("signale un chapitre ouvrant sur une page paire (feuillet de gauche)", () => {
    const items: StructureItem[] = [chapter("c1", "Un"), chapter("c2", "Deux")];
    // 46 pages déclarées → corps = 22 → 11 pages par chapitre :
    // le 1er ouvre page 25 (impaire, belle page), le 2e page 36 (paire → anomalie).
    const uneven = placeChapters(items, 46);
    expect(uneven[1].startPage).toBe(36);
    expect(uneven[1].recto).toBe(false);
    expect(misplacedChapters(uneven).map((item) => item.title)).toEqual(["Deux"]);
  });

  it("ne produit aucun placement sans chapitre", () => {
    expect(placeChapters([{ id: "act-1", type: "act" }], 120)).toEqual([]);
  });
});