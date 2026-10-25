import { describe, expect, it } from "vitest";
import { pdfToSalonChapters } from "../pdfChapters";
import type { PdfPageText, PdfTextItem } from "../pdfChapters";

const text = (str: string, x: number, y: number, height = 12): PdfTextItem => ({ str, x, y, height, width: str.length * 5 });
const header = text("Les Schattenjägers", 200, 770);
const page = (...items: PdfTextItem[]): PdfPageText => ({ height: 800, items: [header, ...items] });

describe("pdfToSalonChapters", () => {
  const pages = [
    page(
      text("Chapitre 1", 300, 650, 20),
      text("L", 72, 596, 40),
      text("a flamme se courbe.Elle ne  s'éteint pas.", 102, 610),
      text("Un frisson incline la flamme.", 72, 592),
      text("Hildegarde garde la plu-", 72, 556),
      text("me suspendue", 72, 538),
      text("12", 300, 20),
    ),
    page(text("au-dessus du vélin.", 72, 700), text("* * *", 300, 664), text("Dehors, la pluie.", 72, 628), text("13", 300, 20)),
    page(text("Chapitre 2", 300, 650, 20), text("La suite.", 72, 610), text("14", 300, 20)),
  ];

  it("rebuilds chapters, paragraphs, drop caps and typography, without running heads or folios", () => {
    const chapters = pdfToSalonChapters(pages, "Le Roman");
    expect(chapters.map((chapter) => chapter.title)).toEqual(["Chapitre 1", "Chapitre 2"]);
    expect(chapters[0].markdown).toBe([
      "# Chapitre 1",
      "La flamme se courbe. Elle ne s’éteint pas. Un frisson incline la flamme.",
      "Hildegarde garde la plume suspendue au-dessus du vélin.",
      "***",
      "Dehors, la pluie.",
    ].join("\n\n"));
    expect(chapters[1].markdown).toBe("# Chapitre 2\n\nLa suite.");
  });

  it("falls back to a single chapter named after the book when no heading is found", () => {
    const [chapter] = pdfToSalonChapters([{ height: 800, items: [text("Il était une fois.", 72, 600)] }], "Le Roman");
    expect(chapter).toEqual({ title: "Le Roman", markdown: "# Le Roman\n\nIl était une fois." });
  });
});
