import { describe, expect, it } from "vitest";
import type { ScriptRule } from "../../../types";
import { applyRules, DEFAULT_RULES, detectProperNouns, splitIntoLines } from "../podcastScript";

const only = (id: ScriptRule["id"], substitutions: ScriptRule["substitutions"] = []): ScriptRule[] =>
  DEFAULT_RULES.map((rule) => ({ ...rule, enabled: rule.id === id, substitutions: rule.id === "proper-nouns" ? substitutions : undefined }));
const texts = (input: string, rules: ScriptRule[]) => applyRules(splitIntoLines(input), rules).map((line) => line.text);

describe("splitIntoLines", () => {
  it("assigne le texte courant au narrateur et les répliques à tiret aux dialogues sans attribution", () => {
    const lines = splitIntoLines("La pluie tombait.\n— Entrez, dit-il.\n- Merci.");
    expect(lines.map((line) => [line.kind, line.role, line.text])).toEqual([
      ["narrator", "Narrateur", "La pluie tombait."],
      ["unattributed-dialogue", "Dialogues", "Entrez, dit-il."],
      ["unattributed-dialogue", "Dialogues", "Merci."],
    ]);
  });

  it("isole les répliques entre guillemets au milieu d'un paragraphe narratif", () => {
    const lines = splitIntoLines("Elle murmura : « Partons. » Puis elle se leva.");
    expect(lines.map((line) => [line.kind, line.text])).toEqual([
      ["narrator", "Elle murmura :"],
      ["unattributed-dialogue", "Partons."],
      ["narrator", "Puis elle se leva."],
    ]);
    expect(lines.map((line) => line.source)).toEqual([0, 1, 2]);
  });

  it("ignore les lignes vides et la ponctuation orpheline", () => {
    expect(splitIntoLines("\n\n« Oui », \n  \n")).toHaveLength(1);
  });
});

describe("règle strip-incises", () => {
  it.each([
    ["— Je pars, dit-elle, il est tard.", "Je pars, il est tard."],
    ["— Je pars demain, dit-il.", "Je pars demain."],
    ["— Viens ! s'écria-t-il.", "Viens !"],
    ["— Je pars — dit-elle — demain.", "Je pars demain."],
    ["— Je pars, répondit-elle en souriant.", "Je pars."],
  ])("allège %s", (input, expected) => {
    expect(texts(input, only("strip-incises"))).toEqual([expected]);
  });

  it("supprime l'incise isolée après une réplique entre guillemets", () => {
    expect(texts("« Viens », dit-il.\nLe soir tombait.", only("strip-incises"))).toEqual(["Viens", "Le soir tombait."]);
  });

  it("ne touche jamais au texte narratif", () => {
    expect(texts("Il dit-il ne sait quoi, puis sortit.", only("strip-incises"))).toEqual(["Il dit-il ne sait quoi, puis sortit."]);
  });

  it("laisse le texte intact quand la règle est désactivée", () => {
    expect(texts("— Je pars, dit-elle.", DEFAULT_RULES)).toEqual(["Je pars, dit-elle."]);
  });
});

describe("transcription d'un chapitre brut", () => {
  const dialogue = "« Bonjour, dit-il, que faites-vous ? »";

  it("élague l'incise d'une réplique entre guillemets", () => {
    expect(texts(dialogue, only("strip-incises"))).toEqual(["Bonjour, que faites-vous ?"]);
    expect(texts(dialogue, DEFAULT_RULES)).toEqual(["Bonjour, dit-il, que faites-vous ?"]);
  });

  it("sépare nettement la narration des répliques et conserve l'ordre du chapitre", () => {
    const chapter = `Il entra sans bruit. ${dialogue} Elle se tut.\n— Rien, répondit-elle.\nLe feu crépitait.`;
    const lines = applyRules(splitIntoLines(chapter), only("strip-incises"));
    expect(lines.map((line) => [line.kind, line.role, line.text])).toEqual([
      ["narrator", "Narrateur", "Il entra sans bruit."],
      ["unattributed-dialogue", "Dialogues", "Bonjour, que faites-vous ?"],
      ["narrator", "Narrateur", "Elle se tut."],
      ["unattributed-dialogue", "Dialogues", "Rien."],
      ["narrator", "Narrateur", "Le feu crépitait."],
    ]);
    expect(lines.map((line) => line.source)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("règle breath-pauses", () => {
  it("normalise les points de suspension", () => {
    expect(texts("Attends ... je crois.... que non.", only("breath-pauses"))).toEqual(["Attends… je crois… que non."]);
    expect(texts("Alors…Il partit.", only("breath-pauses"))).toEqual(["Alors… Il partit."]);
  });

  it("convertit les tirets cadratins en respirations et les propos interrompus en suspension", () => {
    expect(texts("— Je crois — enfin — que oui.", only("breath-pauses"))).toEqual(["Je crois, enfin, que oui."]);
    expect(texts("— Je ne —", only("breath-pauses"))).toEqual(["Je ne…"]);
  });
});

describe("règle proper-nouns", () => {
  it("substitue les noms propres sur des mots entiers, sans interpréter le remplacement", () => {
    const rules = only("proper-nouns", [{ name: "Aldus", spoken: "Al-duss $&" }, { name: "Ann", spoken: "Anne" }]);
    expect(texts("Aldus salua Ann et Annabelle.", rules)).toEqual(["Al-duss $& salua Anne et Annabelle."]);
  });

  it("ignore les entrées incomplètes et les règles désactivées", () => {
    expect(texts("Aldus rit.", only("proper-nouns", [{ name: "Aldus", spoken: " " }]))).toEqual(["Aldus rit."]);
    expect(texts("Aldus rit.", DEFAULT_RULES.map((rule) => ({ ...rule, substitutions: [{ name: "Aldus", spoken: "Al-duss" }] })))).toEqual(["Aldus rit."]);
  });
});

describe("detectProperNouns", () => {
  it("propose les noms capitalisés répétés en milieu de phrase, hors table existante", () => {
    const text = "Le soir, Isaure parla à Mathis. Puis Isaure revit Mathis, et Mathis sourit. Ensuite Paris dormit.";
    expect(detectProperNouns(text, [])).toEqual(["Mathis", "Isaure"]);
    expect(detectProperNouns(text, [{ name: "Mathis", spoken: "Ma-tiss" }])).toEqual(["Isaure"]);
  });
});
