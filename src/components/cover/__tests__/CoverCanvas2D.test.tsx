import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CoverCanvas2D } from "../CoverCanvas2D";
import type { CoverGeometry } from "../../../utils/coverApi";

// `convertFileSrc` s'appuie sur `window.__TAURI_INTERNALS__` (absent en jsdom) :
// on le remplace par une URL déterministe `asset://`.
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://localhost/${encodeURIComponent(path)}`,
}));

afterEach(() => cleanup());

const GEOMETRY: CoverGeometry = {
  trimSize: "6x9",
  paperType: "cream",
  bleedMm: 3.2,
  trimWidthMm: 152.4,
  trimHeightMm: 228.6,
  spine: {
    pagesUsed: 120,
    widthMm: 7.62,
    coefficientMmPerPage: 0.0635,
    textEligible: true,
  },
  totalWidthMm: 318.82,
  totalHeightMm: 235,
  barcode: { xMm: 98.4, yMm: 194.9, widthMm: 50.8, heightMm: 30.5 },
};

const renderCanvas = (overrides: {
  frontPath?: string | null;
  backPath?: string | null;
  onBack?: () => void;
} = {}) =>
  render(
    <CoverCanvas2D
      geometry={GEOMETRY}
      spineText="Nunael — Danoë"
      suggestion={{ colorFront: "#c81e1e", colorBack: "#1e1ec8", gradientRecommended: true }}
      useGradient
      busy={false}
      message={null}
      canExport
      onExport={() => {}}
      onBack={overrides.onBack ?? (() => {})}
      frontPath={overrides.frontPath ?? null}
      backPath={overrides.backPath ?? null}
    />,
  );

/** Nombre de rectangles beiges de repli (`#e7e0d2`). */
const fallbackRects = () =>
  document.querySelectorAll('rect[fill="#e7e0d2"]').length;

describe("CoverCanvas2D — textures réelles dans le SVG", () => {
  it("rend les balises <image> Recto/Verso et supprime les replis beiges", () => {
    renderCanvas({ frontPath: "/tmp/front.png", backPath: "/tmp/back.png" });

    const front = screen.getByTestId("cover-svg-front-image");
    const back = screen.getByTestId("cover-svg-back-image");

    expect(front.getAttribute("href")).toContain("front.png");
    expect(back.getAttribute("href")).toContain("back.png");
    expect(front.getAttribute("preserveAspectRatio")).toBe("none");
    expect(back.getAttribute("preserveAspectRatio")).toBe("none");
    expect(fallbackRects()).toBe(0);
  });

  it("rend les replis beiges et aucune <image> sans chemins fournis", () => {
    renderCanvas();

    expect(screen.queryByTestId("cover-svg-front-image")).toBeNull();
    expect(screen.queryByTestId("cover-svg-back-image")).toBeNull();
    expect(fallbackRects()).toBe(2);
  });
});

describe("CoverCanvas2D — modale plein écran (portal)", () => {
  it("monte la pop-up sous document.body puis ferme et revient aux réglages", () => {
    const onBack = vi.fn();
    renderCanvas({ frontPath: "/tmp/front.png", backPath: "/tmp/back.png", onBack });

    fireEvent.click(screen.getByRole("button", { name: /Plein écran/ }));

    const modal = document.body.querySelector("div.fixed");
    expect(modal).not.toBeNull();
    expect(modal?.parentElement).toBe(document.body);
    expect(screen.getByText(/Planche technique KDP — Plein écran/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Fermer/ }));

    expect(screen.queryByText(/Planche technique KDP — Plein écran/)).toBeNull();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("ferme via la touche Échap et déclenche le retour", () => {
    const onBack = vi.fn();
    renderCanvas({ frontPath: "/tmp/front.png", backPath: "/tmp/back.png", onBack });

    fireEvent.click(screen.getByRole("button", { name: /Plein écran/ }));
    expect(screen.getByText(/Planche technique KDP — Plein écran/)).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByText(/Planche technique KDP — Plein écran/)).toBeNull();
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
