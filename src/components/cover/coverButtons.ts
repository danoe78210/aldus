/**
 * Styles partagés des commandes du **module Couverture** — finition « laiton
 * gravé d'atelier » (charte Dark Atelier : ébène, laiton, or vieilli).
 * Aucun dégradé cuivre/orange criard ni couleur néon.
 */

/** Commande secondaire — petit format (légendes, plein écran, retour de page). */
export const BRASS_BUTTON =
  "rounded-xs border border-[#5a4f3f] bg-[#1a1612] px-3 py-1 font-serif text-xs uppercase tracking-widest text-[#d4af37] shadow-sm transition-all hover:border-[#d4af37] hover:bg-[#251f18] hover:text-[#f3e5ab] disabled:cursor-not-allowed disabled:opacity-50";

/** Commande principale — grand format (confirmation, fermeture de vitrine). */
export const BRASS_BUTTON_PRIMARY =
  "rounded-xs border border-[#7a5e2c] bg-[#1e1913] px-4 py-2 font-serif text-xs uppercase tracking-widest text-[#d4af37] shadow-sm transition-all hover:border-[#d4af37] hover:bg-[#2a2219] hover:text-[#f3e5ab] disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Commande d'**export** — grand format mis en vedette : or vieilli sur bandeau
 * gravé, anti-aliasé pour une frappe nette (aucun effet crénelé).
 */
export const BRASS_BUTTON_EXPORT =
  "rounded-xs border border-[#8f6e2b] bg-linear-to-r from-[#221b14] via-[#2d241a] to-[#221b14] px-6 py-2.5 font-serif text-sm font-medium uppercase tracking-widest text-[#f5efe4] antialiased shadow-md transition-all hover:border-[#d4af37] hover:text-[#d4af37] disabled:cursor-not-allowed disabled:opacity-50";

/** Commande neutre / discrète (retour, annuler). */
export const BRASS_BUTTON_GHOST =
  "rounded-xs border border-[#382f22] bg-transparent px-4 py-2 font-serif text-xs uppercase tracking-widest text-[#9e9587] transition-colors hover:border-[#8f6e2b] hover:text-[#d4af37]";