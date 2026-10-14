import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useStudio, type StudioContextValue } from "../StudioContext";
import { WritingPreview } from "../WritingStudio";

vi.mock("../StudioContext", () => ({ useStudio: vi.fn() }));

const studioState = {
  writingChapter: "chapitre.md",
  writingText: "# Le passage\n\nUne phrase annotée[^archive].\n\n[^archive]: Note d’archive.",
  writingLoading: false,
  manuscriptConfig: {
    bodyFont: "Garamond",
    bodySize: 11,
    lineSpacing: 1.15,
    textAlignment: "justify",
    dropCap: true,
  },
} as StudioContextValue;

describe("WritingPreview", () => {
  beforeEach(() => {
    vi.mocked(useStudio).mockReturnValue(studioState);
  });

  it("renders the chapter with its live footnote", () => {
    const { container } = render(<WritingPreview />);

    expect(screen.getByText("Le passage")).toBeTruthy();
    expect(container.querySelector(".writing-preview__drop-cap")?.textContent)
      .toContain("Une phrase annotée");
    expect(screen.getByRole("region", { name: "Notes de bas de page" }).textContent)
      .toContain("Note d’archive.");
    expect(container.querySelector(".writing-preview__drop-cap")).toBeTruthy();
  });
});
