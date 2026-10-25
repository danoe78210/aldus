declare module "page-flip" {
  export interface PageFlipSettings {
    size: "fixed" | "stretch";
    width: number;
    height: number;
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    usePortrait: boolean;
    showCover: boolean;
    autoSize: boolean;
    drawShadow: boolean;
    maxShadowOpacity: number;
    flippingTime: number;
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: PageFlipSettings);
    loadFromHTML(items: HTMLElement[]): void;
    updateFromHtml(items: HTMLElement[]): void;
    on(event: "flip", callback: (event: { data: unknown }) => void): PageFlip;
    flipNext(): void;
    flipPrev(): void;
    turnToPage(page: number): void;
    getCurrentPageIndex(): number;
    update(): void;
    destroy(): void;
    getRender(): { finishAnimation(): void };
  }
}
