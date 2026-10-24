import { beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useStudio, type StudioContextValue } from "../StudioContext";
import { PlumeProvider } from "../epreuve-plume/PlumeContext";
import { EpreuvePlumeView } from "../epreuve-plume/EpreuvePlumeView";
import { IssuesList } from "../epreuve-plume/IssuesList";
import { highlightSegments, manuscriptBlocks, riskTone, sessionRisk } from "../../utils/stylometryView";
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
  backgroundRisk: 20,
  alertRisk: 42,
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
  expect(screen.getByRole("img", { name: "Risque IA : 47.4 pour cent" })).toBeTruthy();
  expect(screen.getByRole("progressbar", { name: "Rythme & Souffle (Burstiness)" }).getAttribute("aria-valuenow")).toBe("30");
});

it("reduces session risk proportionally from 20 to 11 visible alerts", async () => {
  vi.mocked(auditChapterStylometry).mockResolvedValue({
    ...REPORT,
    aiRiskPercent: 100,
    backgroundRisk: 40,
    alertRisk: 60,
    issuesCount: 20,
    issues: Array.from({ length: 20 }, (_, index) => ({ ...REPORT.issues[1], id: `connector-${index}` })),
  });
  renderPlume();
  await screen.findByText("20 alertes actives");
  for (let ignored = 1; ignored <= 9; ignored += 1) {
    fireEvent.click(screen.getAllByRole("button", { name: "Ignorer" })[0]);
    expect(screen.getByRole("img", { name: `Risque IA : ${100 - ignored * 3} pour cent` })).toBeTruthy();
  }
  expect(screen.getByText("11 alertes actives")).toBeTruthy();
  expect(auditChapterStylometry).toHaveBeenCalledTimes(1);
  expect(applyStylometrySuggestion).not.toHaveBeenCalled();
});

it("retains only the text contribution when all alerts are ignored, including zero-weight rules", () => {
  expect(sessionRisk(REPORT, [], RULES)).toBe(20);
  expect(sessionRisk(REPORT, REPORT.issues, RULES)).toBe(62);
  const rules = RULES.map((rule) => rule.kind.kind === "detection" ? {
    ...rule, kind: { ...rule.kind, penaltyWeight: 0 },
  } : rule);
  expect(sessionRisk({ ...REPORT, alertRisk: 0, aiRiskPercent: 20 }, [], rules)).toBe(20);
});

it("waits for the complete post-apply audit and updates both animated micro-gauges", async () => {
  renderPlume();
  const connector = await screen.findByRole("article", { name: "L.3 · Tic de transition RLHF" });
  const rhythm = screen.getByRole("progressbar", { name: "Rythme & Souffle (Burstiness)" });
  const lexical = screen.getByRole("progressbar", { name: "Empreinte syntaxique / Perplexité" });
  let finishAudit!: (report: StylometryReport) => void;
  vi.mocked(auditChapterStylometry).mockReturnValueOnce(new Promise((resolve) => { finishAudit = resolve; }));
  fireEvent.click(within(connector).getByRole("button", { name: "Appliquer la reformation" }));
  await waitFor(() => expect(auditChapterStylometry).toHaveBeenCalledTimes(2));
  expect(loadProofChapter).toHaveBeenCalledWith("chapitre.md");
  expect(screen.getByRole("button", { name: "Application…" })).toHaveProperty("disabled", true);
  expect(screen.getByRole("img", { name: "Risque IA : 62 pour cent" })).toBeTruthy();
  await act(async () => finishAudit({
    ...REPORT,
    aiRiskPercent: 23.4,
    backgroundRisk: 16,
    alertRisk: 7.4,
    burstinessScore: 40.26,
    lexicalRichness: 77.64,
    issuesCount: 2,
    issues: REPORT.issues.filter((issue) => issue.ruleId !== "rlhf-connectors"),
  }));
  expect(screen.getByRole("img", { name: "Risque IA : 23.4 pour cent" })).toBeTruthy();
  expect(screen.getByText("2 alertes actives")).toBeTruthy();
  expect(rhythm.getAttribute("aria-valuenow")).toBe("40.3");
  expect(lexical.getAttribute("aria-valuenow")).toBe("77.6");
  expect(screen.getByText("40,3 %")).toBeTruthy();
  expect(screen.getByText("77,6 %")).toBeTruthy();
  expect(screen.getByRole("progressbar", { name: "Rythme & Souffle (Burstiness)" })).toBe(rhythm);
  expect(rhythm.firstElementChild?.getAttribute("style")).toContain("40.3%");
  expect(rhythm.firstElementChild?.className).toContain("duration-500 ease-out");
  expect(lexical.firstElementChild?.getAttribute("style")).toContain("77.6%");
});

it("surfaces a post-apply audit failure instead of presenting stale metrics as current", async () => {
  renderPlume();
  const connector = await screen.findByRole("article", { name: "L.3 · Tic de transition RLHF" });
  vi.mocked(auditChapterStylometry).mockRejectedValueOnce(new Error("Audit indisponible"));
  fireEvent.click(within(connector).getByRole("button", { name: "Appliquer la reformation" }));
  await screen.findByRole("alert");
  expect(screen.getByRole("alert").textContent).toBe("Audit indisponible");
  expect(vi.mocked(useStudio)().onNotify).toHaveBeenCalledWith("error", "Audit de stylométrie impossible : Audit indisponible");
  expect(screen.queryByRole("img", { name: "Risque IA : 62 pour cent" })).toBeNull();
});

it("audits the new chapter instead of reloading the previous one if the scope changes during apply", async () => {
  const view = renderPlume();
  const connector = await screen.findByRole("article", { name: "L.3 · Tic de transition RLHF" });
  let finishApply!: () => void;
  vi.mocked(applyStylometrySuggestion).mockReturnValueOnce(new Promise((resolve) => { finishApply = resolve; }));
  fireEvent.click(within(connector).getByRole("button", { name: "Appliquer la reformation" }));
  mockStudio({ proofChapter: "autre.md", chapterFiles: ["chapitre.md", "autre.md"], proofText: "Autre chapitre." });
  vi.mocked(auditChapterStylometry).mockResolvedValue({
    ...REPORT, chapterId: "autre.md", aiRiskPercent: 28.5, backgroundRisk: 28.5, alertRisk: 0, issues: [], issuesCount: 0,
  });
  view.rerender(tree());
  await act(async () => finishApply());
  await screen.findByRole("img", { name: "Risque IA : 28.5 pour cent" });
  expect(auditChapterStylometry).toHaveBeenLastCalledWith("C:/projet", "autre.md");
  expect(loadProofChapter).not.toHaveBeenCalled();
});

it("does not overwrite a newer chapter audit with a late response", async () => {
  let finishOldAudit!: (report: StylometryReport) => void;
  vi.mocked(auditChapterStylometry).mockReturnValueOnce(new Promise((resolve) => { finishOldAudit = resolve; }));
  const view = renderPlume();
  await waitFor(() => expect(auditChapterStylometry).toHaveBeenCalledTimes(1));
  mockStudio({ proofChapter: "autre.md", chapterFiles: ["chapitre.md", "autre.md"], proofText: "Autre chapitre." });
  vi.mocked(auditChapterStylometry).mockResolvedValue({
    ...REPORT, chapterId: "autre.md", aiRiskPercent: 28.5, backgroundRisk: 28.5, alertRisk: 0, issues: [], issuesCount: 0,
  });
  view.rerender(tree());
  await screen.findByRole("img", { name: "Risque IA : 28.5 pour cent" });
  await act(async () => finishOldAudit(REPORT));
  expect(screen.getByRole("img", { name: "Risque IA : 28.5 pour cent" })).toBeTruthy();
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
const ORPHAN = { id: "paragraph-symmetry-34", ruleId: "paragraph-symmetry", originalText: "Il vit rouge, vieux et sombre.", startOffset: 34, endOffset: 64, category: "Rythme", explanation: "Paragraphes de même gabarit.", suggestedRewrite: null };

const mockStudio = (extra: Partial<StudioContextValue>) =>
  vi.mocked(useStudio).mockReturnValue({ ...vi.mocked(useStudio)(), ...extra } as StudioContextValue);

it("reworks an orphan alert in the Retouche editor on the targeted passage", async () => {
  vi.mocked(auditChapterStylometry).mockResolvedValue({ ...REPORT, issues: [...REPORT.issues, ORPHAN] });
  renderPlume();
  const card = await screen.findByRole("article", { name: "L.4 · Paragraphes symétriques" });
  expect(within(card).queryByText(/Aucune reformation automatique/)).toBeNull();
  fireEvent.click(within(card).getByRole("button", { name: "Remanier dans l'éditeur" }));
  const editor = screen.getByLabelText<HTMLTextAreaElement>("Retouche du chapitre");
  expect(screen.getByRole("button", { name: "Retouche" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByLabelText("Feuillet annoté")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(editor));
  expect(editor.value.slice(editor.selectionStart, editor.selectionEnd)).toBe(ORPHAN.originalText);
  // La numérotation suit les lignes logiques du Markdown.
  expect(document.querySelector("[data-line='4']")?.textContent).toContain("4");
  // Une reformation réécrirait le fichier sous le brouillon.
  expect(within(screen.getByRole("article", { name: "L.3 · Tic de transition RLHF" })).getByRole("button", { name: "Appliquer la reformation" })).toHaveProperty("disabled", true);
});

it("saves a manual retouche through the snapshotting save, then returns to the annotated proof", async () => {
  const saveProofRevisions = vi.fn<(next: string) => Promise<boolean>>().mockResolvedValue(true);
  mockStudio({ saveProofRevisions });
  const view = renderPlume();
  await screen.findByRole("article", { name: "L.3 · Tic de transition RLHF" });
  fireEvent.click(screen.getByRole("button", { name: "Retouche" }));
  const edited = TEXT.replace("En effet", "Alors");
  fireEvent.change(screen.getByLabelText("Retouche du chapitre"), { target: { value: edited } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer & réévaluer" }));
  });
  expect(saveProofRevisions).toHaveBeenCalledWith(edited);
  expect(screen.getByLabelText("Feuillet annoté")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Épreuve" }).getAttribute("aria-pressed")).toBe("true");
  vi.mocked(auditChapterStylometry).mockResolvedValue({
    ...REPORT,
    aiRiskPercent: 19.6,
    backgroundRisk: 19.6,
    alertRisk: 0,
    burstinessScore: 45.8,
    lexicalRichness: 78.1,
    issuesCount: 0,
    issues: [],
  });
  mockStudio({ proofText: edited });
  view.rerender(tree());
  await screen.findByRole("img", { name: "Risque IA : 19.6 pour cent" });
  expect(screen.getByRole("progressbar", { name: "Rythme & Souffle (Burstiness)" }).getAttribute("aria-valuenow")).toBe("45.8");
  expect(screen.getByRole("progressbar", { name: "Empreinte syntaxique / Perplexité" }).getAttribute("aria-valuenow")).toBe("78.1");
});

it("keeps the draft open when the save fails and discards it on cancel", async () => {
  const saveProofRevisions = vi.fn<(next: string) => Promise<boolean>>().mockResolvedValue(false);
  mockStudio({ saveProofRevisions });
  renderPlume();
  await screen.findByRole("article", { name: "L.3 · Tic de transition RLHF" });
  fireEvent.click(screen.getByRole("button", { name: "Retouche" }));
  fireEvent.change(screen.getByLabelText("Retouche du chapitre"), { target: { value: "Brouillon" } });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer & réévaluer" }));
  });
  expect(screen.getByLabelText<HTMLTextAreaElement>("Retouche du chapitre").value).toBe("Brouillon");
  fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
  expect(screen.queryByLabelText("Retouche du chapitre")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retouche" }));
  expect(screen.getByLabelText<HTMLTextAreaElement>("Retouche du chapitre").value).toBe(TEXT);
});

it("opens the chapter in the Correcteur's Banc d'Épreuve", async () => {
  const onProofTabChange = vi.fn();
  const onOpenCorrector = vi.fn();
  mockStudio({ onProofTabChange });
  render(
    <PlumeProvider enabled>
      <EpreuvePlumeView onOpenCorrector={onOpenCorrector} />
    </PlumeProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Ouvrir dans le Correcteur" }));
  expect(onProofTabChange).toHaveBeenCalledWith("banc");
  expect(onOpenCorrector).toHaveBeenCalled();
  await waitFor(() => expect(auditChapterStylometry).toHaveBeenCalled());
});
