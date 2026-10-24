import { describe, expect, it } from "vitest";
import type { AudioVoice } from "../../../types";
import { voiceGender, voicesForGender } from "../voiceGender";

const voice = (id: string, name: string, gender?: AudioVoice["gender"]): AudioVoice => ({ id, name, language: "fr-FR", gender });

describe("voiceGender", () => {
  it("déduit le genre des locuteurs XTTS et des mots-clés de profils maison", () => {
    expect(voiceGender(voice("a", "Claribel Dervla"))).toBe("female");
    expect(voiceGender(voice("b", "Viktor Eka"))).toBe("male");
    expect(voiceGender(voice("c", "Voix de femme"))).toBe("female");
    expect(voiceGender(voice("homme-grave", "Profil grave"))).toBe("male");
    expect(voiceGender(voice("d", "Narrateur français"))).toBe("neutral");
  });

  it("préfère le genre déclaré et refuse de trancher quand les indices se contredisent", () => {
    expect(voiceGender(voice("a", "Claribel Dervla", "male"))).toBe("male");
    expect(voiceGender(voice("e", "Viktor et Claribel"))).toBe("neutral");
  });
});

describe("voicesForGender", () => {
  const voices = [voice("a", "Claribel Dervla"), voice("b", "Viktor Eka"), voice("d", "Narrateur français")];

  it("ne retient que les timbres du genre choisi, « Indifférent » ouvrant tout le catalogue", () => {
    expect(voicesForGender(voices, "female").map((entry) => entry.id)).toEqual(["a"]);
    expect(voicesForGender(voices, "male").map((entry) => entry.id)).toEqual(["b"]);
    expect(voicesForGender(voices, "neutral")).toHaveLength(3);
  });
});
