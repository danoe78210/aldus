import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ReadingSalon } from "../ReadingSalon";
import type { SalonChapter } from "../salonMarkdown";

type FlipEvent = { data: unknown };

const engine = vi.hoisted(() => {
  class FakePageFlip {
    static instances: FakePageFlip[] = [];
    static calls: string[] = [];
    pages: HTMLElement[] = [];
    index = 0;
    destroyed = false;
    flipHandler: ((event: FlipEvent) => void) | null = null;
    host: HTMLElement;
    settings: Record<string, unknown>;
    constructor(host: HTMLElement, settings: Record<string, unknown>) { this.host = host; this.settings = settings; FakePageFlip.instances.push(this); }
    loadFromHTML(items: HTMLElement[]) { this.pages = items; this.host.replaceChildren(...items); }
    updateFromHtml(items: HTMLElement[]) { FakePageFlip.calls.push("updateFromHtml"); this.loadFromHTML(items); }
    on(_event: string, callback: (event: FlipEvent) => void) { this.flipHandler = callback; return this; }
    getCurrentPageIndex() { return this.index; }
    turnToPage(page: number) { FakePageFlip.calls.push(`turnToPage:${page}`); this.index = page; }
    flipNext() { FakePageFlip.calls.push("flipNext"); this.index += 2; this.flipHandler?.({ data: this.index }); }
    flipPrev() { FakePageFlip.calls.push("flipPrev"); this.index -= 2; this.flipHandler?.({ data: this.index }); }
    update() {}
    destroy() { this.destroyed = true; this.host.remove(); }
    getRender() { return { finishAnimation() {} }; }
  }
  return FakePageFlip;
});
vi.mock("page-flip", () => ({ PageFlip: engine }));

const CHAPTERS: SalonChapter[] = [
  { title: "Premier chapitre", markdown: "# Premier chapitre\n\nIl était une fois un scribe. « Venez ! » — dit-il.\n\n* * *\n\nLa nuit tomba sur Vasselonne." },
  { title: "Second chapitre", markdown: "# Second chapitre\n\nLa suite arriva." },
];
const SPREADS: Record<string, number> = { "Premier chapitre": 3, "Second chapitre": 2 };
const CLIENT_WIDTH = 1000;
const CLIENT_HEIGHT = 800;
const STEP = CLIENT_WIDTH + 64;

const sheets = () => {
  const left = document.querySelector(".salon-sheet:not([aria-hidden])") as HTMLElement;
  const right = document.querySelector(`.salon-sheet[data-page="${Number(left.dataset.page) + 1}"]`) as HTMLElement;
  return [left, right];
};
const folios = () => sheets().map((sheet) => sheet.querySelector(".salon-folio")?.textContent);
const flow = () => sheets()[0].querySelector("article.salon-flow") as HTMLElement;
const press = (key: string) => fireEvent.keyDown(window, { key });

beforeEach(() => {
  localStorage.clear();
  engine.instances.length = 0;
  engine.calls.length = 0;
  vi.spyOn(Element.prototype, "clientWidth", "get").mockReturnValue(CLIENT_WIDTH);
  vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(CLIENT_HEIGHT);
  vi.spyOn(Element.prototype, "scrollWidth", "get").mockImplementation(function (this: Element) {
    const title = Object.keys(SPREADS).find((name) => this.textContent?.includes(name)) ?? "";
    return (SPREADS[title] ?? 1) * 2 * STEP - 64;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderSalon = () => render(<ReadingSalon bookId="book-1" title="Le Roman" chapters={CHAPTERS} />);

describe("ReadingSalon", () => {
  it("renders the chapter Markdown directly as typeset prose, keeping dashes and non-breaking spaces", () => {
    renderSalon();
    expect(screen.getByRole("heading", { name: "Premier chapitre" })).toBeTruthy();
    const article = screen.getByRole("article", { name: "Premier chapitre" });
    expect(article.getAttribute("lang")).toBe("fr");
    expect(article.textContent).toContain("Il était une fois un scribe. « Venez ! » — dit-il.");
    expect(article.querySelector("hr")).not.toBeNull();
    expect(screen.getByRole("region", { name: "Salon de lecture — Le Roman" }).getAttribute("data-theme")).toBe("atelier");
  });

  it("shows the running heads, the folios and the progress", () => {
    renderSalon();
    const heads = sheets().map((sheet) => sheet.querySelector(".salon-head")?.textContent);
    expect(heads).toEqual(["Le Roman", "Premier chapitre"]);
    expect(folios()).toEqual(["1", "2"]);
    expect(screen.getByRole("status", { name: "Progression" }).textContent).toBe("Chapitre 1 sur 2 · 17 %");
  });

  it("turns spreads with the keyboard and crosses chapter limits in both directions", () => {
    renderSalon();
    press("ArrowRight");
    expect(folios()).toEqual(["3", "4"]);
    expect(flow().style.transform).toBe(`translateX(${-2 * STEP}px)`);
    press("PageDown");
    expect(folios()).toEqual(["5", "6"]);

    press("ArrowRight");
    expect(screen.getByRole("article", { name: "Second chapitre" })).toBeTruthy();
    expect(folios()).toEqual(["1", "2"]);
    expect(sheets()[1].querySelector(".salon-head")?.textContent).toBe("Second chapitre");
    expect(screen.getByRole("status", { name: "Progression" }).textContent).toBe("Chapitre 2 sur 2 · 75 %");

    press("ArrowLeft");
    expect(screen.getByRole("article", { name: "Premier chapitre" })).toBeTruthy();
    expect(folios()).toEqual(["5", "6"]);
    press("PageUp");
    expect(folios()).toEqual(["3", "4"]);
  });

  it("stops at the first and last pages of the book", () => {
    renderSalon();
    const previous = screen.getByRole("button", { name: "Page précédente" }) as HTMLButtonElement;
    const next = screen.getByRole("button", { name: "Page suivante" }) as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    press("ArrowLeft");
    expect(folios()).toEqual(["1", "2"]);
    for (let index = 0; index < 4; index += 1) fireEvent.click(next);
    expect(screen.getByRole("article", { name: "Second chapitre" })).toBeTruthy();
    expect(next.disabled).toBe(true);
    press("ArrowRight");
    expect(folios()).toEqual(["3", "4"]);
  });

  it("jumps to a chapter from the spine drawer", () => {
    renderSalon();
    expect(screen.queryByRole("complementary", { name: "Tiroir de tranche" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Table des matières" }));
    expect(screen.getByRole("button", { name: "Premier chapitre", current: true })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Second chapitre" }));
    expect(screen.getByRole("article", { name: "Second chapitre" })).toBeTruthy();
    expect(screen.queryByRole("complementary", { name: "Tiroir de tranche" })).toBeNull();
  });

  it("saves the reading position and resumes from it", () => {
    const first = renderSalon();
    press("ArrowRight");
    press("PageDown");
    press("ArrowRight");
    press("ArrowRight");
    expect(JSON.parse(localStorage.getItem("aldus-salon-resume:book-1") ?? "null")).toEqual({ chapter: 1, spread: 1 });
    first.unmount();

    renderSalon();
    expect(screen.getByRole("article", { name: "Second chapitre" })).toBeTruthy();
    expect(folios()).toEqual(["3", "4"]);
  });

  describe("slider d'avancement", () => {
    const slider = () => screen.getByRole("slider", { name: "Avancement dans l’ouvrage" }) as HTMLInputElement;
    const seek = (value: number) => fireEvent.change(slider(), { target: { value: String(value) } });

    it("follows the active spread, whatever turns the pages", () => {
      renderSalon();
      expect(slider().max).toBe("2000");
      expect(slider().value).toBe("333");
      press("ArrowRight");
      expect(slider().value).toBe("667");
      press("PageDown");
      expect(slider().value).toBe("1000");
      press("ArrowRight");
      expect(slider().value).toBe("1500");
      fireEvent.click(screen.getByRole("button", { name: "Page suivante" }));
      expect(slider().value).toBe("2000");
      expect(slider().getAttribute("aria-valuetext")).toBe("Chapitre 2 · Page 3");
    });

    it("jumps to the targeted chapter and spread on change", () => {
      renderSalon();
      seek(1500);
      expect(screen.getByRole("article", { name: "Second chapitre" })).toBeTruthy();
      expect(folios()).toEqual(["1", "2"]);
      expect(screen.getByRole("status", { name: "Progression" }).textContent).toBe("Chapitre 2 sur 2 · 75 %");

      seek(2000);
      expect(folios()).toEqual(["3", "4"]);
      seek(667);
      expect(screen.getByRole("article", { name: "Premier chapitre" })).toBeTruthy();
      expect(folios()).toEqual(["3", "4"]);
      expect(slider().value).toBe("667");
      seek(0);
      expect(folios()).toEqual(["1", "2"]);
    });

    it("marks each chapter entry and names the position in a tooltip while handled", () => {
      const { container } = renderSalon();
      expect(container.querySelectorAll(".salon-tick")).toHaveLength(2);
      expect(screen.queryByRole("tooltip")).toBeNull();
      fireEvent.focus(slider());
      expect(screen.getByRole("tooltip").textContent).toBe("Chapitre 1 · Page 1");
      seek(2000);
      expect(screen.getByRole("tooltip").textContent).toBe("Chapitre 2 · Page 3");
      fireEvent.blur(slider());
      expect(screen.queryByRole("tooltip")).toBeNull();
    });

    it("leaves page turning to the arrow keys while the slider has the focus", () => {
      renderSalon();
      slider().focus();
      fireEvent.keyDown(slider(), { key: "ArrowRight", bubbles: true });
      expect(folios()).toEqual(["3", "4"]);
    });
  });

  describe("page-flip", () => {
    const book = () => engine.instances[0];

    it("opens one permanent double-page book with realistic shadows, never a single page", () => {
      renderSalon();
      expect(engine.instances).toHaveLength(1);
      expect(book().settings).toMatchObject({ size: "stretch", usePortrait: false, showCover: false, drawShadow: true, maxShadowOpacity: 0.5 });
      expect(book().pages).toHaveLength(6);
      expect(book().pages.every((page) => page.classList.contains("reading-salon-page"))).toBe(true);
    });

    it("delegates the arrows and the keys to flipNext and flipPrev", () => {
      renderSalon();
      press("ArrowRight");
      expect(engine.calls).toContain("flipNext");
      expect(folios()).toEqual(["3", "4"]);
      fireEvent.click(screen.getByRole("button", { name: "Page précédente" }));
      expect(engine.calls).toContain("flipPrev");
      expect(folios()).toEqual(["1", "2"]);
    });

    it("follows a page turned by the library itself, such as a mouse drag", () => {
      renderSalon();
      act(() => { book().flipHandler?.({ data: 4 }); });
      expect(folios()).toEqual(["5", "6"]);
      expect(JSON.parse(localStorage.getItem("aldus-salon-resume:book-1") ?? "null")).toEqual({ chapter: 0, spread: 2 });
    });

    it("delegates the slider and the table of contents to turnToPage, without flip feedback", () => {
      renderSalon();
      fireEvent.change(screen.getByRole("slider"), { target: { value: "667" } });
      expect(engine.calls).toContain("turnToPage:2");
      expect(book().getCurrentPageIndex()).toBe(2);
      expect(folios()).toEqual(["3", "4"]);

      fireEvent.click(screen.getByRole("button", { name: "Table des matières" }));
      fireEvent.click(screen.getByRole("button", { name: "Second chapitre" }));
      expect(engine.instances).toHaveLength(1);
      expect(engine.calls).toContain("updateFromHtml");
      expect(book().pages).toHaveLength(4);
      expect(book().getCurrentPageIndex()).toBe(0);
    });
  });

  it("switches between the Atelier Sombre and Vélin Naturel papers and remembers the choice", () => {
    const first = renderSalon();
    fireEvent.click(screen.getByRole("button", { name: "Passer au Vélin Naturel" }));
    expect(screen.getByRole("region").getAttribute("data-theme")).toBe("velin");
    first.unmount();
    renderSalon();
    expect(screen.getByRole("region").getAttribute("data-theme")).toBe("velin");
    expect(screen.getByRole("button", { name: "Passer à l’Atelier Sombre" })).toBeTruthy();
  });
});
