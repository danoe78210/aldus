/** Accorde un décompte à la française (0 et 1 au singulier), avec espace insécable entre le nombre et le mot. */
export const frenchCount = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count.toLocaleString("fr-FR")}\u00a0${count < 2 ? singular : plural}`;
