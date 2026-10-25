import type { ActiveMenu, NavPole } from "../../types";

export interface PoleDefinition {
  id: NavPole;
  label: string;
  views: { id: ActiveMenu; label: string }[];
}

export const POLES: PoleDefinition[] = [
  {
    id: "ecritoire",
    label: "Écritoire",
    views: [
      { id: "infos", label: "Registre" },
      { id: "ecritoire", label: "Manuscrit" },
      { id: "organisation", label: "Façonnage" },
      { id: "correcteur", label: "Correcteur" },
      { id: "epreuve-plume", label: "Épreuve stylistique" },
      { id: "banc-epreuve", label: "Banc d'épreuve" },
    ],
  },
  {
    id: "presse",
    label: "Presse",
    views: [
      { id: "reglages", label: "Réglages" },
      { id: "couverture", label: "Couverture" },
      { id: "export", label: "Impression" },
    ],
  },
  {
    id: "oratoire",
    label: "Oratoire",
    views: [
      { id: "studio-audio", label: "Studio Audio" },
      { id: "discotheque", label: "Discothèque" },
      { id: "lecteur", label: "Le Lecteur" },
    ],
  },
  {
    id: "bibliotheque",
    label: "Bibliothèque",
    views: [
      { id: "bibliotheque", label: "La Bibliothèque" },
      { id: "salon", label: "Salon de lecture" },
    ],
  },
];

export const DEFAULT_VIEW_BY_POLE: Record<NavPole, ActiveMenu> = {
  ecritoire: "ecritoire",
  presse: "couverture",
  oratoire: "studio-audio",
  bibliotheque: "bibliotheque",
};

/** Vues qui occupent toute la largeur de l'établi (sans double page). */
export const FULL_WIDTH_MENUS: readonly ActiveMenu[] = ["bibliotheque", "studio-audio", "discotheque", "lecteur", "salon"];

export const poleOf = (menu: ActiveMenu): PoleDefinition =>
  POLES.find((pole) => pole.views.some((view) => view.id === menu)) ?? POLES[0];

export const viewLabel = (menu: ActiveMenu): string =>
  poleOf(menu).views.find((view) => view.id === menu)?.label ?? "";
