import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Cover3DPreview } from "../Cover3DPreview";

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://localhost/${encodeURIComponent(path)}`,
}));

afterEach(() => cleanup());

const renderPreview = (overrides: {
  frontPath?: string | null;
  backPath?: string | null;
  onBackToSettings?: () => void;
} = {}) =>
  render(
    <Cover3DPreview
      trimWidthMm={152.4}
      trimHeightMm={228.6}
      spineWidthMm={7.62}
      spineText="Nunael — Danoë"
      spineColor="#c81e1e"
      spineColorAlt="#1e1ec8"
      useGradient
      spineTextEligible
      frontPath={overrides.frontPath ?? null}
      backPath={overrides.backPath ?? null}
      onBack={() => {}}
      onBackToSettings={overrides.onBackToSettings ?? (() => {})}
      onExport={() => {}}
      canExport
      busy={false}
    />,
  );

describe("Cover3DPreview — textures réelles", () => {
  it("applique les URLs converties aux faces Plat 1 et Plat 4", () => {
    renderPreview({ frontPath: "/tmp/front.png", backPath: "/tmp/back.png" });

    expect(screen.getByTestId("cover-3d-front-face").style.backgroundImage).toContain(
      "front.png",
    );
    expect(screen.getByTestId("cover-3d-back-face").style.backgroundImage).toContain(
      "back.png",
    );
  });

  it("retombe sur le cuir par défaut sans image", () => {
    renderPreview();

    const background = screen.getByTestId("cover-3d-front-face").style.backgroundImage;
    expect(background).not.toContain("asset://");
    expect(background).toContain("linear-gradient");
  });
});

describe("Cover3DPreview — vitrine immersive (portal)", () => {
  it("monte le portail sous document.body, ferme et revient aux réglages", () => {
    const onBackToSettings = vi.fn();
    renderPreview({
      frontPath: "/tmp/front.png",
      backPath: "/tmp/back.png",
      onBackToSettings,
    });

    fireEvent.click(screen.getByRole("button", { name: /Vue immersive/ }));

    const modal = document.body.querySelector("div.fixed");
    expect(modal).not.toBeNull();
    expect(modal?.parentElement).toBe(document.body);
    expect(screen.getByText(/Volume 3D — Vue immersive/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Fermer/ }));

    expect(screen.queryByText(/Volume 3D — Vue immersive/)).toBeNull();
    expect(onBackToSettings).toHaveBeenCalledTimes(1);
  });

  it("ferme via la touche Échap et revient aux réglages", () => {
    const onBackToSettings = vi.fn();
    renderPreview({ onBackToSettings });

    fireEvent.click(screen.getByRole("button", { name: /Vue immersive/ }));
    expect(screen.getByText(/Volume 3D — Vue immersive/)).toBeTruthy();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByText(/Volume 3D — Vue immersive/)).toBeNull();
    expect(onBackToSettings).toHaveBeenCalledTimes(1);
  });
});
