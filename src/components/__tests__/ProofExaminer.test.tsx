import { beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useStudio, type StudioContextValue } from "../StudioContext";
import { ProofExaminer } from "../ProofExaminer";

vi.mock("../StudioContext", () => ({ useStudio: vi.fn() }));

const mockUseStudio = vi.mocked(useStudio);
const persistProofChapter = vi.fn<() => Promise<void>>();

beforeEach(() => {
  cleanup();
  persistProofChapter.mockReset().mockResolvedValue(undefined);
  mockUseStudio.mockReturnValue({
    chapterFiles: ["Chapitre 1.md"],
    proofTab: "banc",
    proofEnabledRules: [],
    proofChapter: "Chapitre 1.md",
    proofText: "Texte corrigé.",
    proofDirty: false,
    proofSaved: false,
    proofLoading: false,
    proofError: null,
    loadProofChapter: vi.fn(),
    proofPage: 1,
    setProofPage: vi.fn(),
    proofOnlyAnomalies: false,
    setProofOnlyAnomalies: vi.fn(),
    applyProofAnomaly: vi.fn(),
    activeAnomalyId: null,
    setActiveAnomalyId: vi.fn(),
    imposeProofUsage: vi.fn(),
    persistProofChapter,
    saveProofRevisions: vi.fn(),
  } as unknown as StudioContextValue);
});

it("enables validation only for dirty chapters and persists on click", async () => {
  const cleanView = render(<ProofExaminer />);
  const button = screen.getByRole("button", { name: "Valider les corrections" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  cleanView.unmount();

  mockUseStudio.mockReturnValue({
    ...mockUseStudio(),
    proofDirty: true,
  } as StudioContextValue);
  render(<ProofExaminer />);

  const validateButton = screen.getByRole("button", { name: "Valider les corrections" }) as HTMLButtonElement;
  expect(validateButton.disabled).toBe(false);
  fireEvent.click(validateButton);
  expect(persistProofChapter).toHaveBeenCalledOnce();
});
