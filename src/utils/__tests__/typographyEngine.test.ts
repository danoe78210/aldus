import { describe, expect, it } from "vitest";
import {
  APOSTROPHE,
  ELLIPSIS,
  EM_DASH,
  EN_DASH,
  NBSP,
  NNBSP,
  analyzeTypography,
  applyAldineUsage,
  applyAnomaly,
} from "../typographyEngine";

/** Raccourci : applique l'ordre majeur et renvoie le texte corrigé. */
const fixed = (text: string): string => applyAldineUsage(text).text;

/** Raccourci : nombre d'anomalies d'une règle donnée. */
const countOf = (text: string, rule: string): number =>
  analyzeTypography(text).anomalies.filter((anomaly) => anomaly.rule === rule).length;

describe("moteur aldin — ponctuation haute & espaces insécables", () => {
  it("pose l'insécable normale avant le deux-points", () => {
    expect(fixed("Il entra : la porte claqua.")).toBe(`Il entra${NBSP}: la porte claqua.`);
    expect(countOf("Il entra : la porte claqua.", "nbsp-colon")).toBe(1);
  });

  it("pose l'insécable fine avant ; ! ? et recolle les signes simples", () => {
    expect(fixed("Qui va là ? Personne ; vraiment !")).toBe(
      `Qui va là${NNBSP}? Personne${NNBSP}; vraiment${NNBSP}!`,
    );
    expect(fixed("Il attendit .puis partit ,vite")).toBe("Il attendit.puis partit,vite");
  });

  it("remplace les points de suspension dactylographiques et l'espace parasite", () => {
    const report = analyzeTypography("Il hésita... puis ...");
    expect(report.anomalies.filter((a) => a.rule === "ellipsis")).toHaveLength(2);
    expect(fixed("Il hésita ...")).toBe(`Il hésita${ELLIPSIS}`);
  });
});

describe("moteur aldin — guillemets & dialogues", () => {
  it("convertit les guillemets droits en guillemets français (premier rang)", () => {
    expect(fixed('Il dit "bonjour" à tous.')).toBe(
      `Il dit ${"«"}${NNBSP}bonjour${NNBSP}${"»"} à tous.`,
    );
  });

  it("emploie les guillemets anglais courbes dans une citation imbriquée", () => {
    const source = 'Il dit « bonjour "ami" » à tous.';
    const result = applyAldineUsage(source).text;
    expect(result).toContain(`\u201Cami\u201D`);
  });

  it("colle les espaces intérieures des guillemets français", () => {
    expect(fixed("« Bonjour »")).toBe(`«${NNBSP}Bonjour${NNBSP}»`);
  });

  it("remplace le tiret dactylographique de dialogue par un cadratin", () => {
    expect(fixed("- Qui va là ?\n- Un ami.")).toBe(
      `${EM_DASH}${NBSP}Qui va là${NNBSP}?\n${EM_DASH}${NBSP}Un ami.`,
    );
    expect(countOf("- Qui va là ?", "dialogue-dash")).toBe(1);
  });

  it("encadre l'incise de demi-cadratins", () => {
    expect(fixed("Venise - la Sérénissime - dormait.")).toBe(
      `Venise${NBSP}${EN_DASH}${NBSP}la Sérénissime${NBSP}${EN_DASH}${NBSP}dormait.`,
    );
  });
});

describe("moteur aldin — apostrophes, ligatures & accents", () => {
  it("courbe les apostrophes droites", () => {
    expect(fixed("l'atelier d'Aldus")).toBe(`l${APOSTROPHE}atelier d${APOSTROPHE}Aldus`);
  });

  it("fusionne les ligatures obligatoires sans toucher aux faux amis", () => {
    expect(fixed("Le coeur de l'oeuvre")).toBe(`Le cœur de l${APOSTROPHE}œuvre`);
    expect(fixed("Le coefficient de coexistence et la moelle")).toBe(
      "Le coefficient de coexistence et la moelle",
    );
    expect(fixed("Ils sont ex aequo au curriculum vitae")).toBe(
      "Ils sont ex æquo au curriculum vitæ",
    );
  });

  it("rétablit les majuscules accentuées et les accents intérieurs", () => {
    expect(fixed("A la lumière des Etats")).toBe(`À la lumière des États`);
    expect(fixed("C'etait etre et meme deja")).toBe(
      `C${APOSTROPHE}était être et même déjà`,
    );
  });
});

describe("moteur aldin — nombres, siècles & civilités", () => {
  it("sépare les tranches de mille par une insécable", () => {
    expect(fixed("10.000 feuillets et 1,500 pages")).toBe(
      `10${NBSP}000 feuillets et 1${NBSP}500 pages`,
    );
  });

  it("lie le siècle à son numéral", () => {
    expect(fixed("au xix siècle puis au xxie siècle")).toBe(
      `au xix${NBSP}siècle puis au xxie${NBSP}siècle`,
    );
  });

  it("lie les civilités, abréviations et numéros", () => {
    expect(fixed("M. Dupont, chap. II, n° 12, p. 4")).toBe(
      `M.${NBSP}Dupont, chap.${NBSP}II, n°${NBSP}12, p.${NBSP}4`,
    );
  });
});

describe("moteur aldin — hygiène spatiale & application", () => {
  it("réduit les doubles espaces et supprime les blancs de fin de ligne", () => {
    expect(fixed("Deux  espaces   ici  \net là")).toBe("Deux espaces ici\net là");
  });

  it("signale un texte conforme comme parfait (pureté 100)", () => {
    const clean = `Il entra${NBSP}: «${NNBSP}bonjour${NNBSP}».`;
    const report = analyzeTypography(clean);
    expect(report.total).toBe(0);
    expect(report.purity).toBe(100);
  });

  it("calcule un indice de pureté dégressif et les décomptes par famille", () => {
    const report = analyzeTypography("Il dit : coeur  et \"ame\"");
    expect(report.purity).toBeLessThan(100);
    expect(report.byFamily.letters).toBeGreaterThan(0);
    expect(report.bySeverity.critical).toBeGreaterThan(0);
  });

  it("corrige une seule occurrence (clic sur une glose)", () => {
    const [first] = analyzeTypography("coeur et coeur").anomalies;
    expect(applyAnomaly("coeur et coeur", first)).toBe("cœur et coeur");
  });

  it("restreint l'examen aux règles activées (basse-cour)", () => {
    const report = analyzeTypography("coeur : \"x\"", ["ligature-oe"]);
    expect(report.total).toBe(1);
    expect(report.anomalies[0].rule).toBe("ligature-oe");
  });

  it("est idempotent : un texte déjà justifié ne bouge plus", () => {
    const once = fixed("Il dit : coeur  et \"ame\"");
    expect(applyAldineUsage(once).applied).toBe(0);
  });
});