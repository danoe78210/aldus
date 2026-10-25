import { escapeMarkdown, typeset } from "./salonMarkdown";
import type { SalonChapter } from "./salonMarkdown";

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfPageText {
  height: number;
  items: PdfTextItem[];
}

interface Line {
  text: string;
  x: number;
  y: number;
  size: number;
  margin: boolean;
}

const MARGIN_BAND = 0.07;
const HEADING = /^(chapitre|prologue|épilogue|epilogue|interlude|acte|partie|livre)\b/i;
const SCENE_BREAK = /^[*•·\s]{3,}$/;
const SENTENCE_END = /[.!?…»”"]$/;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
};

/** Les fragments d'une page, regroupés en lignes de lecture ; la lettrine (grande capitale isolée) est soudée à sa ligne. */
const pageLines = ({ height, items }: PdfPageText): Line[] => {
  const fragments = items.filter((item) => item.str.trim() !== "" || item.str.includes(" "));
  const body = median(fragments.map((item) => item.height));
  const isDropCap = (item: PdfTextItem) => item.str.trim().length === 1 && item.height >= body * 1.8;
  const dropCaps = fragments.filter(isDropCap);
  const rows: PdfTextItem[][] = [];
  for (const item of fragments.filter((fragment) => !isDropCap(fragment)).sort((a, b) => b.y - a.y || a.x - b.x)) {
    const row = rows.find((candidate) => Math.abs(candidate[0].y - item.y) <= item.height * 0.5);
    if (row) row.push(item);
    else rows.push([item]);
  }
  const lines = rows.map((row): Line => {
    const ordered = row.sort((a, b) => a.x - b.x);
    const text = ordered.reduce((joined, item, index) => {
      const previous = ordered[index - 1];
      const gap = previous ? item.x - (previous.x + previous.width) : 0;
      return joined + (previous && gap > item.height * 0.15 && !joined.endsWith(" ") && !item.str.startsWith(" ") ? " " : "") + item.str;
    }, "");
    const y = ordered[0].y;
    return { text: text.trim(), x: ordered[0].x, y, size: ordered[0].height, margin: y < height * MARGIN_BAND || y > height * (1 - MARGIN_BAND) };
  }).filter((line) => line.text !== "");
  for (const cap of dropCaps) {
    const line = lines.filter((candidate) => candidate.y <= cap.y + cap.height && candidate.y >= cap.y - cap.height * 0.3 && candidate.x >= cap.x).sort((a, b) => b.y - a.y)[0];
    if (line) { line.text = `${cap.str.trim()}${line.text}`; line.x = cap.x; }
    else lines.push({ text: cap.str.trim(), x: cap.x, y: cap.y, size: cap.height, margin: false });
  }
  return lines.sort((a, b) => b.y - a.y);
};

const SOFT_HYPHEN = String.fromCharCode(173);

// shortcut: un tiret de fin de ligne suivi d'une minuscule est tenu pour une coupure de mot (un « peut-être » coupé perd son tiret)
const joinLines = (parts: string[]): string =>
  parts.reduce((joined, part) => {
    const cut = joined.endsWith(SOFT_HYPHEN) || /\p{L}-$/u.test(joined);
    return cut && /^\p{Ll}/u.test(part) ? joined.slice(0, -1) + part : `${joined} ${part}`.trim();
  }, "");

/** Le texte d'un PDF recomposé en chapitres Markdown : en-têtes et folios retirés, paragraphes reconstitués d'une page à l'autre. */
export const pdfToSalonChapters = (pages: PdfPageText[], title: string): SalonChapter[] => {
  const perPage = pages.map(pageLines);
  const seen = new Map<string, number>();
  for (const lines of perPage) for (const text of new Set(lines.filter((line) => line.margin).map((line) => line.text))) seen.set(text, (seen.get(text) ?? 0) + 1);
  const chapters: { title: string; blocks: string[] }[] = [];
  let paragraph: string[] = [];
  const startChapter = (name: string) => chapters.push({ title: name, blocks: [`# ${escapeMarkdown(name)}`] });
  const flush = () => {
    if (paragraph.length === 0) return;
    if (chapters.length === 0) startChapter(title);
    chapters[chapters.length - 1].blocks.push(typeset(escapeMarkdown(joinLines(paragraph))));
    paragraph = [];
  };

  for (const lines of perPage) {
    const kept = lines.filter((line) => !(line.margin && (/^\d+$/.test(line.text) || (seen.get(line.text) ?? 0) >= 3)));
    const left = Math.min(...kept.map((line) => line.x));
    const size = median(kept.map((line) => line.size));
    const step = Math.min(...kept.slice(1).map((line, index) => kept[index].y - line.y).filter((delta) => delta > size * 0.8));
    kept.forEach((line, index) => {
      const gap = index === 0 ? 0 : kept[index - 1].y - line.y;
      const indented = line.x - left > line.size * 0.8;
      if (HEADING.test(line.text) && line.text.length <= 70) {
        flush();
        startChapter(line.text);
      } else if (SCENE_BREAK.test(line.text)) {
        flush();
        if (chapters.length > 0) chapters[chapters.length - 1].blocks.push("***");
      } else {
        const continued = index === 0 && !indented && paragraph.length > 0 && !SENTENCE_END.test(paragraph[paragraph.length - 1]);
        if (!continued && (indented || gap > step * 1.35 || index === 0)) flush();
        paragraph.push(line.text);
      }
    });
  }
  flush();
  return chapters.map((chapter) => ({ title: chapter.title, markdown: chapter.blocks.join("\n\n") }));
};

/** Lit le texte de chaque page d'un PDF (via pdf.js, chargé à la demande). */
export const loadPdfChapters = async (url: string, title: string): Promise<SalonChapter[]> => {
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Lecture du PDF impossible (${response.status}).`);
  const task = pdfjs.getDocument({ data: new Uint8Array(await response.arrayBuffer()) });
  try {
    const doc = await task.promise;
    const pages: PdfPageText[] = [];
    for (let number = 1; number <= doc.numPages; number += 1) {
      const page = await doc.getPage(number);
      const { items } = await page.getTextContent();
      pages.push({
        height: page.getViewport({ scale: 1 }).height,
        items: items.flatMap((item) => "str" in item ? [{ str: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: Math.abs(item.transform[3]) || item.height }] : []),
      });
    }
    return pdfToSalonChapters(pages, title);
  } finally {
    void task.destroy();
  }
};
