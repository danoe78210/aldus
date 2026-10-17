import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Layout } from "../Layout";

vi.mock("../TopBar", () => ({ TopBar: () => null }));
vi.mock("../StatusBar", () => ({ StatusBar: () => null }));
vi.mock("../MenuFlipBook", () => ({ MenuFlipBook: () => <div data-testid="menu-flipbook" /> }));
vi.mock("../StudioContext", () => ({ useStudio: () => ({ cover: { frontPath: null, backPath: null, gradient: false, spineColorFront: null, spineColorBack: null, pageCount: 120, spineText: "" } }) }));

afterEach(cleanup);

const layoutProps = {
  leftContent: <nav aria-label="Navigation atelier">Navigation</nav>,
  bookPages: [],
  activeIndex: 0,
  progress: 0,
  progressLabel: "Aldus",
  running: false,
  logs: [],
  saveState: "idle" as const,
};

describe("Layout", () => {
  it("gives the library a full-width workspace without a spread or flipbook while retaining navigation", () => {
    const { container } = render(<Layout {...layoutProps} fullWidthContent={<h1>Bibliothèque</h1>} />);
    expect(screen.getByRole("region", { name: "Espace bibliothèque" })).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Navigation atelier" })).toBeTruthy();
    expect(container.querySelector(".book-spread")).toBeNull();
    expect(screen.queryByTestId("menu-flipbook")).toBeNull();
  });

  it("keeps the original diptych for the other benches and restores it when leaving the library", () => {
    const view = render(<Layout {...layoutProps} fullWidthContent={<h1>Bibliothèque</h1>} />);
    view.rerender(<Layout {...layoutProps} />);
    expect(screen.queryByRole("region", { name: "Espace bibliothèque" })).toBeNull();
    expect(view.container.querySelector(".book-spread")).toBeTruthy();
    expect(screen.getByTestId("menu-flipbook")).toBeTruthy();
  });
});