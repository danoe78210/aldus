import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { SubNavHeader } from "../SubNavHeader";
import { POLES, poleOf } from "../poles";
import { usePoleNavigation } from "../usePoleNavigation";

afterEach(cleanup);

describe("poleOf", () => {
  it("rattache chaque vue à son pôle", () => {
    expect(poleOf("infos").id).toBe("ecritoire");
    expect(poleOf("organisation").id).toBe("ecritoire");
    expect(poleOf("banc-epreuve").id).toBe("ecritoire");
    expect(poleOf("couverture").id).toBe("presse");
    expect(poleOf("export").id).toBe("presse");
    expect(poleOf("studio-audio").id).toBe("oratoire");
    expect(poleOf("discotheque").id).toBe("oratoire");
    expect(poleOf("lecteur").id).toBe("oratoire");
    expect(poleOf("bibliotheque").id).toBe("bibliotheque");
    expect(poleOf("reglages").id).toBe("presse");
  });

  it("n'expose que les quatre signets canoniques", () => {
    expect(POLES.map((pole) => pole.label)).toEqual(["Écritoire", "Presse", "Oratoire", "Bibliothèque"]);
  });
});

describe("usePoleNavigation", () => {
  it("rouvre la dernière sous-vue d'un pôle lors de la bascule", () => {
    const { result } = renderHook(() => usePoleNavigation("reglages"));

    act(() => result.current.setActiveMenu("epreuve-plume"));
    act(() => result.current.setActivePole("presse"));
    expect(result.current.activeMenu).toBe("reglages");

    act(() => result.current.setActiveMenu("export"));
    act(() => result.current.setActivePole("ecritoire"));
    expect(result.current.activeMenu).toBe("epreuve-plume");

    act(() => result.current.setActivePole("presse"));
    expect(result.current.activeMenu).toBe("export");
  });

  it("garde la vue initiale comme mémoire de son pôle", () => {
    const { result } = renderHook(() => usePoleNavigation("reglages"));
    act(() => result.current.setActivePole("oratoire"));
    expect(result.current.activeMenu).toBe("studio-audio");
    act(() => result.current.setActivePole("presse"));
    expect(result.current.activeMenu).toBe("reglages");
  });
});

describe("SubNavHeader", () => {
  it("affiche les sous-vues du pôle actif et signale la vue courante", () => {
    render(<SubNavHeader activeMenu="couverture" onSelect={() => undefined} />);
    expect(screen.getByRole("navigation", { name: "Sous-navigation — Presse" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Couverture" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("button", { name: "Impression" }).getAttribute("aria-current")).toBeNull();
    expect(screen.queryByRole("button", { name: "Correcteur" })).toBeNull();
  });

  it("propose les trois onglets de l'Oratoire, sans numérotation", () => {
    const onSelect = vi.fn();
    render(<SubNavHeader activeMenu="discotheque" onSelect={onSelect} />);
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Studio Audio", "Discothèque", "Le Lecteur"]);
    expect(screen.getByRole("button", { name: "Discothèque" }).getAttribute("aria-current")).toBe("page");
    fireEvent.click(screen.getByRole("button", { name: "Le Lecteur" }));
    expect(onSelect).toHaveBeenCalledWith("lecteur");
  });

  it("transmet la sous-vue choisie", () => {
    const onSelect = vi.fn();
    render(<SubNavHeader activeMenu="ecritoire" onSelect={onSelect} />);
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual(["Registre", "Manuscrit", "Façonnage", "Correcteur", "Épreuve stylistique", "Banc d'épreuve"]);
    fireEvent.click(screen.getByRole("button", { name: "Banc d'épreuve" }));
    expect(onSelect).toHaveBeenCalledWith("banc-epreuve");
  });
});
