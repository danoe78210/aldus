import type { AudioVoice, VoiceGender } from "../../types";

export const GENDER_LABELS: Record<VoiceGender, string> = {
  male: "Homme",
  female: "Femme",
  neutral: "Indifférent / Autre",
};

// Prénoms des locuteurs fournis avec XTTS v2 ; les profils maison se reconnaissent à leurs mots-clés.
const FEMALE_NAMES = "claribel daisy gracie tammie alison ana annmarie asya brenda gitta henriette sofia tammy tanja vjollca nova maja uta lidiya chandra szofi camilla lilya zofija narelle barbora alexandra rosemary";
const MALE_NAMES = "andrew badr dionisio royston viktor abrahan adde baldur craig damien gilberto ilkin kazuhiko ludvig suad torcull zacharie ige filip damjan wulf aaron kumar eugenio ferran xavier luis marcos";
const FEMALE_WORDS = new Set([...FEMALE_NAMES.split(" "), "femme", "female", "woman", "girl", "feminine", "féminine", "fem"]);
const MALE_WORDS = new Set([...MALE_NAMES.split(" "), "homme", "male", "man", "boy", "masculine", "masculin", "masc"]);

/** Genre déclaré par la voix, sinon déduit de son nom ou de son identifiant ; « neutral » si rien ne tranche. */
export const voiceGender = (voice: AudioVoice): VoiceGender => {
  if (voice.gender) return voice.gender;
  const words = `${voice.name} ${voice.id}`.toLocaleLowerCase("fr").split(/[^\p{L}]+/u);
  const female = words.some((word) => FEMALE_WORDS.has(word));
  const male = words.some((word) => MALE_WORDS.has(word));
  return female === male ? "neutral" : female ? "female" : "male";
};

/** Voix proposées pour un genre : « Indifférent / Autre » ouvre tout le catalogue. */
export const voicesForGender = (voices: AudioVoice[], gender: VoiceGender): AudioVoice[] =>
  gender === "neutral" ? voices : voices.filter((voice) => voiceGender(voice) === gender);
