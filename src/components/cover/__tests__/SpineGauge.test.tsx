import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SpineGauge } from "../SpineGauge";

afterEach(() => cleanup());

const renderGauge = (overrides: {
  spineWidthMm?: number;
  spineText?: string;
  isEligible?: boolean;
} = {}) =>
  render(
    <SpineGauge
      spineWidthMm={overrides.spineWidthMm ?? 7.62}
      spineText={overrides.spineText ?? "Nunael — Danoë"}
      textColor="#ffffff"
      backgroundColor="#1c140e"
      backgroundGradientEnd={null}
      isEligible={overrides.isEligible ?? true}
    />,
  );

describe("SpineGauge — affichage de la jauge de tranche", () => {
  it("affiche le texte du dos et la largeur en mm si isEligible === true", () => {
    renderGauge();

    expect(screen.getByTestId("spine-gauge")).toBeTruthy();
    expect(screen.getByTestId("spine-gauge-text").textContent).toBe("Nunael — Danoë");
    expect(screen.getByText("7.62 mm")).toBeTruthy();
  });

  it("affiche l'état bloqué et masque le texte si isEligible === false", () => {
    renderGauge({ isEligible: false, spineText: "Nunael" });

    expect(screen.getByTestId("spine-gauge-ineligible")).toBeTruthy();
    expect(screen.queryByTestId("spine-gauge-text")).toBeNull();
    expect(screen.queryByTestId("spine-gauge-safety-left")).toBeNull();
    expect(screen.queryByTestId("spine-gauge-safety-right")).toBeNull();
  });

  it("matérialise les repères de marge de sécurité (1,6 mm) de chaque côté", () => {
    renderGauge();

    const left = screen.getByTestId("spine-gauge-safety-left");
    const right = screen.getByTestId("spine-gauge-safety-right");
    // Espacement resserré : ~1,6 mm × (largeur bornée / largeur de tranche).
    expect(parseFloat(left.style.width)).toBeGreaterThan(10);
    expect(parseFloat(right.style.width)).toBeGreaterThan(10);
  });

  it("alerte sur un risque de débordement du texte sur les mors", () => {
    renderGauge({ spineWidthMm: 3, spineText: "Un titre de tranche beaucoup trop long" });

    expect(screen.getByTestId("spine-gauge-warning")).toBeTruthy();
  });
});
