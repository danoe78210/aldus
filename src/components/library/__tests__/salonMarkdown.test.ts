import { describe, expect, it } from "vitest";
import { contentToSalonChapters, footnotesToSuperscripts, typeset } from "../salonMarkdown";

describe("footnotesToSuperscripts", () => {
  it("turns named notes into numbered superscripts and drops their definitions", () => {
    const source = "Un mot[^a] puis un autre\\[^b\\] et encore[^a].\n\n[^a]: La première note.\n[^b]: La seconde.\n";
    expect(footnotesToSuperscripts(source)).toBe("Un mot¹ puis un autre² et encore¹.");
  });

  it("writes multi-digit numbers digit by digit", () => {
    const calls = Array.from({ length: 10 }, (_, index) => `x[^n${index}]`).join(" ");
    expect(footnotesToSuperscripts(calls).endsWith("x¹⁰")).toBe(true);
  });
});

describe("typeset", () => {
  it("curls apostrophes, collapses double spaces and spaces out glued sentences", () => {
    expect(typeset("L'aube  se leva sur la courbe.Elle sourit ! Vraiment?Oui.")).toBe("L’aube se leva sur la courbe. Elle sourit ! Vraiment? Oui.");
  });

  it("leaves initials and abbreviations alone", () => {
    expect(typeset("U.S.A et M. Dupont")).toBe("U.S.A et M. Dupont");
  });

  it("spaces out a sentence glued to an emphasised start", () => {
    expect(typeset("courbe.*Elle* sourit")).toBe("courbe. *Elle* sourit");
  });
});

describe("contentToSalonChapters", () => {
  it("recomposes reader blocks as Markdown, escaping literal markers and keeping emphasis tight", () => {
    const [chapter] = contentToSalonChapters({
      format: "epub",
      chapters: [{
        title: "Un",
        blocks: [
          { kind: "heading", level: 2, runs: [{ text: "Un" }] },
          { kind: "dialogue", level: 0, runs: [{ text: "— Venez " }, { text: " vite ", italic: true }, { text: "* ici" }] },
          { kind: "rule", level: 0, runs: [] },
          { kind: "quote", level: 0, runs: [{ text: "Cité", bold: true }] },
        ],
      }],
    });
    expect(chapter.markdown).toBe("## Un\n\n— Venez *vite* \\* ici\n\n***\n\n> **Cité**");
  });
});
