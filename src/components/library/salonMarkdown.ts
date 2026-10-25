import type { ReaderBlock, ReaderContent, ReaderRun } from "../../types";

export interface SalonChapter {
  title: string;
  markdown: string;
}

export const escapeMarkdown = (text: string): string => text.replace(/[\\`*_[\]<>#~|]/g, "\\$&");

const emphasize = (run: ReaderRun): string => {
  const marker = `${run.bold ? "**" : ""}${run.italic ? "*" : ""}`;
  const body = escapeMarkdown(run.text);
  const core = body.trim();
  if (!marker || !core) return body;
  const start = body.indexOf(core);
  return `${body.slice(0, start)}${marker}${core}${[...marker].reverse().join("")}${body.slice(start + core.length)}`;
};

/** Rigueur typographique : apostrophes courbes, espaces simples, espace après la ponctuation forte collée à la phrase suivante. */
export const typeset = (text: string): string =>
  text
    .replace(/'/g, "’")
    .replace(/([\p{Ll}»”)])([.!?…])(\**)(?=\p{Lu})/gu, "$1$2 $3")
    .replace(/[ \t]{2,}/g, " ");

const line = (block: ReaderBlock): string => typeset(block.runs.map(emphasize).join("").replace(/\s*\n\s*/g, " ").trim());

const toMarkdown = (block: ReaderBlock): string => {
  if (block.kind === "rule") return "***";
  const text = line(block);
  if (!text) return "";
  if (block.kind === "heading") return `${"#".repeat(Math.min(6, Math.max(1, block.level)))} ${text}`;
  return block.kind === "quote" ? `> ${text}` : text;
};

/** Les blocs du Lecteur d'Atelier, recomposés en Markdown : un seul flux pour le pupitre du Salon. */
export const contentToSalonChapters = (content: ReaderContent): SalonChapter[] =>
  content.chapters.map((chapter) => ({
    title: chapter.title,
    markdown: chapter.blocks.map(toMarkdown).filter(Boolean).join("\n\n"),
  }));

const SUPERSCRIPTS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const FOOTNOTE_DEFINITION = /^[ \t]*\\?\[\^[^\]\r\n]+?\\?\]:.*(?:\r?\n|$)/gm;
const FOOTNOTE_CALL = /\\?\[\^([^\]\\\s]+)\\?\]/g;

/** Les notes `[^nom]` deviennent des exposants discrets (¹, ², …) dans l'ordre d'appel ; leurs définitions quittent le flux. */
export const footnotesToSuperscripts = (markdown: string): string => {
  const numbers = new Map<string, number>();
  return markdown.replace(FOOTNOTE_DEFINITION, "").replace(FOOTNOTE_CALL, (_match, name: string) => {
    if (!numbers.has(name)) numbers.set(name, numbers.size + 1);
    return [...String(numbers.get(name))].map((digit) => SUPERSCRIPTS[Number(digit)]).join("");
  }).trimEnd();
};
