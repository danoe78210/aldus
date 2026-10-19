import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useStudio, type StudioContextValue } from "../../StudioContext";
import { CoverPlate } from "../CoverPlate";

vi.mock("../../StudioContext", () => ({ useStudio: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://localhost/${encodeURIComponent(path)}`,
}));

afterEach(() => cleanup());

const renderPlate = (frontPath: string | null) => {
  const onCoverChange = vi.fn();
  vi.mocked(useStudio).mockReturnValue({
    manuscriptConfig: { trimSize: "6x9" },
    bookInfo: { title: "Titre", author: "Auteur" },
    cover: {
      frontPath,
      backPath: null,
      backLogoPath: null,
      pageCount: 120,
      pageCountSnapshot: 120,
      paperType: "cream",
      spineText: "Titre — Auteur",
      gradient: false,
      structureSignature: "sig",
    },
    onCoverChange,
    structureSignature: "sig",
    coverExportRequest: 0,
    imageFiles: ["Illustrations/Plats/couverture.png", "vignette.webp"],
    projectDirectory: "C:\\Projet",
  } as unknown as StudioContextValue);
  render(<CoverPlate />);
  return onCoverChange;
};

describe("CoverPlate workspace images", () => {
  it("lists nested workspace images and stores their absolute path", () => {
    const onCoverChange = renderPlate(null);
    const select = screen.getByLabelText("Plat 1 — illustration") as HTMLSelectElement;

    expect(screen.getAllByRole("option", { name: "Illustrations/Plats/couverture.png" })).toHaveLength(2);
    expect(screen.queryByRole("option", { name: "vignette.webp" })).toBeNull();

    fireEvent.change(select, { target: { value: "C:\\Projet\\Illustrations\\Plats\\couverture.png" } });
    expect(onCoverChange).toHaveBeenCalledWith({
      frontPath: "C:\\Projet\\Illustrations\\Plats\\couverture.png",
    });
  });

  it("shows the current cover when it comes from the workspace", () => {
    renderPlate("C:\\Projet\\Illustrations\\Plats\\couverture.png");
    const select = screen.getByLabelText("Plat 1 — illustration") as HTMLSelectElement;

    expect(select.selectedOptions[0].textContent).toBe("Illustrations/Plats/couverture.png");
  });
});
