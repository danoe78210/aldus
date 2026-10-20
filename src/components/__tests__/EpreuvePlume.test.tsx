import { beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useStudio, type StudioContextValue } from "../StudioContext";
import { PlumeProvider } from "../epreuve-plume/PlumeContext";
import { EpreuvePlumeView } from "../epreuve-plume/EpreuvePlumeView";
import { IssuesList } from "../epreuve-plume/IssuesList";
import { highlightSegments, manuscriptBlocks, riskTone } from "../../utils/stylometryView";
import {
  applyStylometrySuggestion,
  auditChapterStylometry,
  getStylometryRules,
  type StylometryReport,
  type StylometryRule,
} from "../../utils/stylometryApi";

vi.mock("../StudioContext", () => ({ useStudio: vi.fn() }));
vi.mock("../../utils/stylometryApi", () => ({
  getStylometryRules: vi.fn(),
  saveStylometryRules: vi.fn(),
  auditChapterStylometry: vi.fn(),
  applyStylometrySuggestion: vi.fn(),
}));

const TEXT = "Titre\n\nEn effet, la forêt répond.\nIl vit rouge, vieux et sombre.";
const RULES = [
  { id: "rlhf-connectors", name: "Connecteurs", enabled: true, isBuiltin: true, kind: { kind: "detection", patternType: "regex", pattern: "", penaltyWeight: 8, category: "Tics", explanation: "", defaultSuggestion: null } },
  { id: "r-det-triads", name: "Triades", enabled: true, isBuiltin: true, kind: { kind: "detection", patternType: "triadPattern", pattern: "", penaltyWeight: 7, category: "Tics", explanation: "", defaultSuggestion: null } },
  { id: "r-det-zipf", name: "Zipf", enabled: true, isBuiltin: true, kind: { kind: "detection", patternType: "lexicalPredictability", pattern: "", penaltyWeight: 8, category: "Rareté", explanation: "", defaultSuggestion: null } },
] as StylometryRule[];
const REPORT: StylometryReport = {
  chapterId: "chapitre.md",
  aiRiskPercent: 62,
  burstinessScore: 30,
  lexicalRichness: 70,
  issuesCount: 3,
  issues: [
    { id: "r-det-zipf-34", ruleId: "r-det-zipf", originalText: "Il vit rouge, vieux et sombre.", startOffset: 34, endOffset: 64, category: "Rareté", explanation: "Mesure du chapitre : 70 % de mots-outils.", suggestedRewrite: "Il vit rouge. Vieux et sombre." },
    { id: "rlhf-connectors-7", ruleId: "rlhf-connectors", originalText: "En effet", startOffset: 7, endOffset: 15, category: "Tics", explanation: "Tic de liaison.", suggestedRewrite: "De fait" },
    { id: "r-det-triads-41", ruleId: "r-det-triads", originalText: "rouge, vieux et sombre", startOffset: 41, endOffset: 63, category: "Tics", explanation: "Triade.", suggestedRewrite: "rouge, vieux, sombre" },
  ],
};

const loadProofChapter = vi.fn<(file: string) => Promise<void>>();

const tree = () => (
  <PlumeProvider enabled>
    <EpreuvePlumeView />
    <IssuesList />
  </PlumeProvider>
);
const renderPlume = () => render(tree());

beforeEach(() => {
  cleanup();
  loadProofChapter.mockReset().mockResolvedValue(undefined);
  vi.mocked(getStylometryRules).mockReset().mockResolvedValue(RULES);
  vi.mocked(auditChapterStylometry).mockReset().mockResolvedValue(REPORT);
  vi.mocked(applyStylometrySuggestion).mockReset().mockResolvedValue(undefined);
  vi.mocked(useStudio).mockReturnValue({
    chapterFiles: ["chapitre.md"],
    proofChapter: "chapitre.md",
    proofText: TEXT,
    proofDirty: false,
    proofLoading: false,
    proofError: null,
    loadProofChapter,
    onNotify: vi.fn(),
    sourceConfig: { directory: "C:/projet" },
  } as unknown as StudioContextValue);
});

it("colours the risk circle by severity band", () => {
  expect(riskTone(25).color).toBe("#d4af37");
  expect(riskTone(26).color).toBe("#d99b32");
  expect(riskTone(50).color).toBe("#d99b32");
  expect(riskTone(51).color).toBe("#c24b2a");
});

it("splits highlights on Unicode code points and gives nested passages to the innermost alert", () => {
  const segments = highlightSegments("é🙂ab", [
    { id: "a", ruleId: "x", originalText: "🙂ab", startOffset: 1, endOffset: 4, category: "", explanation: "", suggestedRewrite: null },
    { id: "b", ruleId: "x", originalText: "a", startOffset: 2, endOffset: 3, category: "", explanation: "", suggestedRewrite: null },
  ]);
  expect(segments).toEqual([
    { text: "é", issueId: null },
    { text: "🙂", issueId: "a" },
    { text: "a", issueId: "b" },
    { text: "b", issueId: "a" },
  ]);
});

it("renders stylometric cards with line numbers, highlights and no Banc X rules", async () => {
  renderPlume();
  const connector = await screen.findByRole("article", { name: "L.3 · Tic de transition RLHF" });
  expect(within(connector).getByText("« De fait »")).toBeTruthy();
  expect(screen.getByRole("article", { name: "L.4 · Triade rhétorique" })).toBeTruthy();
  expect(screen.getByText("3 alertes actives")).toBeTruthy();
  expect(screen.queryByText(/Feuillet \d+ sur/)).toBeNull();
  expect(screen.queryByText(/insécable/i)).toBeNull();
  expect(screen.getByRole("img", { name: "Risque IA : 62 pour cent" }).querySelector("span")?.getAttribute("style")).toContain("rgb(194, 75, 42)");
  expect(screen.getByRole("progressbar", { name: "Rythme & Souffle (Burstiness)" }).getAttribute("aria-valuenow")).toBe("30");
  // La phrase Zipf reste surlignée autour de la triade qu'elle contient.
  const marks = screen.getByLabelText("Feuillet annoté").querySelectorAll("mark");
  expect(Array.from(marks).map((mark) => [mark.textContent, mark.dataset.issueId])).toEqual([
    ["En effet", "rlhf-connectors-7"],
    ["Il vit ", "r-det-zipf-34"],
    ["rouge, vieux et sombre", "r-det-triads-41"],
    [".", "r-det-zipf-34"],
  ]);
});

it("makes chapter-level lexical alerts located, highlighted and applicable", async () => {
  renderPlume();
  const zipf = await screen.findByRole("article", { name: "L.4 · Prédictibilité lexicale (Zipf)" });
  expect(within(zipf).getByText("« Il vit rouge. Vieux et sombre. »")).toBeTruthy();
  fireEvent.mouseEnter(zipf);
  const zipfMarks = Array.from(screen.getByLabelText("Feuillet annoté").querySelectorAll<HTMLElement>("mark[data-issue-id='r-det-zipf-34']"));
  expect(zipfMarks).toHaveLength(2);
  zipfMarks.forEach((mark) => expect(mark.className).toContain("bg-[#c24b2a]/45"));
  await act(async () => {
    fireEvent.click(within(zipf).getByRole("button", { name: "Appliquer la reformation" }));
  });
  expect(applyStylometrySuggestion).toHaveBeenCalledWith("C:/projet", "chapitre.md", REPORT.issues[0], "Il vit rouge. Vieux et sombre.");
});

it("links highlighted passages and cards in both directions", async () => {
  renderPlume();
  const triad = await screen.findByRole("article", { name: "L.4 · Triade rhétorique" });
  const mark = screen.getByRole("button", { name: "rouge, vieux et sombre" });
  fireEvent.mouseEnter(triad);
  expect(mark.className).toContain("bg-[#c24b2a]/45");
  fireEvent.mouseLeave(triad);
  expect(mark.className).toContain("bg-[#c24b2a]/25");
  fireEvent.click(mark);
  await waitFor(() => expect(document.activeElement).toBe(triad));
  expect(triad.className).toContain("border-[#d4af37]");
});

it("ignores an alert for the session without touching the file", async () => {
  renderPlume();
  const connector = await screen.findByRole("article", { name: "L.3 · Tic de transition RLHF" });
  fireEvent.click(within(connector).getByRole("button", { name: "Ignorer" }));
  expect(screen.getByText("2 alertes actives")).toBeTruthy();
  expect(screen.queryByRole("article", { name: "L.3 · Tic de transition RLHF" })).toBeNull();
  expect(applyStylometrySuggestion).not.toHaveBeenCalled();
});

it("applies the Forge rewrite through the snapshotting backend and re-audits", async () => {
  const view = renderPlume();
  const connector = await screen.findByRole("article", { name: "L.3 · Tic de transition RLHF" });
  vi.mocked(auditChapterStylometry).mockResolvedValue({ ...REPORT, aiRiskPercent: 20, issuesCount: 2, issues: REPORT.issues.filter((issue) => issue.ruleId !== "rlhf-connectors") });
  await act(async () => {
    fireEvent.click(within(connector).getByRole("button", { name: "Appliquer la reformation" }));
  });
  expect(applyStylometrySuggestion).toHaveBeenCalledWith("C:/projet", "chapitre.md", REPORT.issues[1], "De fait");
  await waitFor(() => expect(loadProofChapter).toHaveBeenCalledWith("chapitre.md"));
  // Le rechargement du chapitre fournit un nouveau texte : l'audit est relancé.
  vi.mocked(useStudio).mockReturnValue({ ...vi.mocked(useStudio)(), proofText: TEXT.replace("En effet", "De fait") } as StudioContextValue);
  view.rerender(tree());
  expect(await screen.findByText("2 alertes actives")).toBeTruthy();
  expect(screen.getByRole("img", { name: "Risque IA : 20 pour cent" })).toBeTruthy();
});

it("maps Markdown headings and paragraphs while keeping source offsets", () => {
  const source = "# Chapitre\n\n## I. L'ombre\n\nLa flamme.\nElle tremble.\n\n« Je suis là. »";
  expect(manuscriptBlocks(source).map((block) => [block.kind, Array.from(source).slice(block.start, block.end).join("")])).toEqual([
    ["title", "Chapitre"],
    ["subtitle", "I. L'ombre"],
    ["paragraph", "La flamme.\nElle tremble."],
    ["paragraph", "« Je suis là. »"],
  ]);
});

it("renders the manuscript justified in French, without Markdown hashes", async () => {
  vi.mocked(useStudio).mockReturnValue({ ...vi.mocked(useStudio)(), proofText: `# Tit${TEXT.slice(5)}` } as StudioContextValue);
  renderPlume();
  await screen.findByRole("article", { name: "L.3 · Tic de transition RLHF" });
  const sheet = screen.getByLabelText("Feuillet annoté");
  expect(sheet.getAttribute("lang")).toBe("fr");
  expect(within(sheet).getByRole("heading", { name: "Tit" }).className).toContain("text-center");
  expect(sheet.textContent).not.toContain("#");
  const paragraph = sheet.querySelector("p");
  expect(paragraph?.className).toContain("text-justify");
  expect(paragraph?.className).toContain("hyphens-auto");
  expect(within(sheet).getByRole("button", { name: "En effet" })).toBeTruthy();
});