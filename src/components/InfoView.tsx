import React, { type ReactNode } from "react";
import { useStudio } from "./StudioContext";
import type { BookInfoConfig } from "../types";

/** Libellé de champ — petite capitale vénitienne, ivoire patiné. */
const labelClass =
  "mb-1.5 block font-serif text-xs tracking-wider text-[#c9bea9] uppercase";

/** Champ standard — ébène, filet laiton au focus. */
const inputClass =
  "w-full rounded-xs border border-[#3a3022] bg-[#13110f] px-3 py-2 font-serif text-sm text-[#f5efe4] transition-colors placeholder:italic placeholder:text-[#5a5040] focus:border-[#d4af37] focus:outline-none";

/** Champ en vedette — titre de l'œuvre, plus ample et plus clair. */
const featuredInputClass =
  "w-full rounded-xs border border-[#3e3425] bg-[#13110f] px-3.5 py-2.5 font-serif text-base text-[#fbf6ea] transition-colors placeholder:italic placeholder:text-[#5a5040] focus:border-[#d4af37] focus:outline-none";

/** Champ secondaire — sous-titre, encre légèrement patinée. */
const mutedInputClass =
  "w-full rounded-xs border border-[#3a3022] bg-[#13110f] px-3 py-2 font-serif text-sm text-[#e8dcc4] transition-colors placeholder:italic placeholder:text-[#5a5040] focus:border-[#d4af37] focus:outline-none";

type FieldVariant = "default" | "featured" | "muted";

const VARIANT_CLASS: Record<FieldVariant, string> = {
  default: inputClass,
  featured: featuredInputClass,
  muted: mutedInputClass,
};

interface InfoInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
  /** Champ pleine largeur (occupe les 2 colonnes). */
  full?: boolean;
  /** Importance typographique du champ. */
  variant?: FieldVariant;
}

/** Champ texte court : libellé au-dessus, saisie encadrée (validation au blur). */
const InfoInput: React.FC<InfoInputProps> = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  full = false,
  variant = "default",
}) => (
  <div className={`flex flex-col ${full ? "col-span-2" : ""}`}>
    <label className={labelClass}>{label}</label>
    <input
      type={type}
      defaultValue={value}
      onBlur={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className={VARIANT_CLASS[variant]}
    />
  </div>
);

interface InfoTextAreaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Zone multiligne pleine largeur (éléments annexes) — encre patinée, cadre or bruni. */
const textAreaClass =
  "w-full resize-none rounded-xs border border-[#3e3425] bg-[#13110f] p-3 font-serif text-sm leading-relaxed text-[#e8dcc4] transition-colors placeholder:italic placeholder:text-[#5a5040] focus:border-[#d4af37] focus:outline-none";

/** Zone multiligne pleine largeur (éléments annexes). */
const InfoTextArea: React.FC<InfoTextAreaProps> = ({
  label,
  value,
  onChange,
  placeholder,
}) => (
  <div className="col-span-2 flex flex-col">
    <label className={labelClass}>{label}</label>
    <textarea
      defaultValue={value}
      onBlur={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={5}
      className={textAreaClass}
    />
  </div>
);

/** Section logique : titre en petites capitales dorées + grille à 2 colonnes. */
const Section: React.FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
  <section className="mb-8">
    <h3 className="mb-4 border-b border-[#3d3528] pb-1 font-serif text-[11px] tracking-widest text-[#d4af37] uppercase">
      {title}
    </h3>
    <div className="grid grid-cols-2 gap-x-8 gap-y-5">{children}</div>
  </section>
);

/** Écrivain de champ lié à l'état global (autosauvegarde `.danoe`). */
const useFieldWriter = () => {
  const { onInfoFieldChange } = useStudio();
  return (section: string, label: string, field: keyof BookInfoConfig) =>
    (value: string) =>
      onInfoFieldChange(section, label, field, value);
};

/** Feuillet I — **L'Œuvre & les Créateurs** (page de gauche du registre). */
export const InfoIdentityPanel: React.FC = () => {
  const { bookInfo: config } = useStudio();
  const set = useFieldWriter();

  return (
    <div className="animate-ink-reveal mx-auto flex h-full w-full max-w-2xl flex-col overflow-y-auto px-2 pr-1">
      <h2 className="mb-6 text-center font-serif text-lg tracking-[0.25em] text-[#d4af37] uppercase">
        I. Identité de l&rsquo;Œuvre
      </h2>

      <Section title="Titres &amp; Saga">
        <InfoInput
          label="Titre du livre"
          full
          variant="featured"
          value={config.title}
          placeholder="ex. Nunael"
          onChange={set("Identité de l'œuvre", "Titre du livre", "title")}
        />
        <InfoInput
          label="Sous-titre"
          full
          variant="muted"
          value={config.subtitle}
          onChange={set("Identité de l'œuvre", "Sous-titre", "subtitle")}
        />
        <InfoInput
          label="Nom de la série / Saga"
          full
          value={config.sagaTitle}
          placeholder="ex. Les Schattenjägers"
          onChange={set("Identité de l'œuvre", "Nom de la série / Saga", "sagaTitle")}
        />
        <InfoInput
          label="Numéro de tome"
          type="number"
          value={config.volumeNumber}
          placeholder="ex. 1"
          onChange={set("Identité de l'œuvre", "Numéro de tome", "volumeNumber")}
        />
      </Section>

      <Section title="Paternité">
        <InfoInput
          label="Auteur principal"
          value={config.author}
          placeholder="ex. Danoë"
          onChange={set("Auteurs et contributeurs", "Nom de l'auteur principal", "author")}
        />
        <InfoInput
          label="Traducteur ou illustrateur"
          value={config.contributor}
          placeholder="Optionnel"
          onChange={set("Auteurs et contributeurs", "Traducteur ou illustrateur", "contributor")}
        />
      </Section>
    </div>
  );
};

/** Feuillet II — **Édition & Mentions légales** (page de droite du registre). */
export const InfoEditionPanel: React.FC = () => {
  const { bookInfo: config } = useStudio();
  const set = useFieldWriter();

  return (
    /* Feuillet II : révélation d'encre légèrement décalée (staggered). */
    <div
      className="animate-ink-reveal mx-auto flex h-full w-full max-w-2xl flex-col overflow-y-auto px-2 pr-1"
      style={{ animationDelay: "90ms" }}
    >
      <h2 className="mb-6 text-center font-serif text-lg tracking-[0.25em] text-[#d4af37] uppercase">
        II. Édition &amp; Mentions Légales
      </h2>

      <Section title="Mentions Légales">
        <InfoInput
          label="Nom de l'éditeur"
          value={config.publisher}
          placeholder="ex. Auto-édition ou nom de la maison"
          onChange={set("Édition et mentions légales", "Nom de l'éditeur", "publisher")}
        />
        <InfoInput
          label="Numéro ISBN"
          value={config.isbn}
          placeholder="ex. 978-2-…"
          onChange={set("Édition et mentions légales", "Numéro ISBN", "isbn")}
        />
        <InfoInput
          label="Date de parution"
          value={config.year}
          placeholder="ex. Octobre 2026"
          onChange={set("Édition et mentions légales", "Date de parution", "year")}
        />
        <InfoInput
          label="Lieu d'impression"
          value={config.printLocation}
          placeholder="ex. France"
          onChange={set("Édition et mentions légales", "Lieu d'impression", "printLocation")}
        />
      </Section>

      <Section title="Apparat &amp; Bibliographie">
        <InfoTextArea
          label="Autres œuvres du même auteur"
          value={config.otherBooks}
          placeholder="ex. Titre 1, Titre 2, Titre 3"
          onChange={set("Éléments annexes", "Autres œuvres", "otherBooks")}
        />
      </Section>
    </div>
  );
};
