import { invokeCommand } from "./tauri";

export type StylometryPatternType =
  | "exactMatch"
  | "regex"
  | "isometryChain"
  | "paragraphSymmetry"
  | "authorLexicon"
  | "punctuationExpressive"
  | "triadPattern"
  | "markdownList"
  | "chapterConclusion"
  | "lexicalPredictability"
  | "entropyUniform"
  | "humanisationAnchoring";

export type StylometryRuleKind =
  | {
      kind: "detection";
      patternType: StylometryPatternType;
      pattern: string;
      penaltyWeight: number;
      category: string;
      explanation: string;
      defaultSuggestion: string | null;
    }
  | {
      kind: "humanisation";
      patternType: StylometryPatternType;
      pattern: string;
      bonusWeight: number;
      category: string;
      explanation: string;
    };

export interface StylometryRule {
  id: string;
  name: string;
  enabled: boolean;
  isBuiltin: boolean;
  kind: StylometryRuleKind;
}

export interface StylometryIssue {
  id: string;
  ruleId: string;
  originalText: string;
  startOffset: number;
  endOffset: number;
  category: string;
  explanation: string;
  suggestedRewrite: string | null;
}

export interface StylometryReport {
  chapterId: string;
  aiRiskPercent: number;
  burstinessScore: number;
  lexicalRichness: number;
  issuesCount: number;
  issues: StylometryIssue[];
}

export const getStylometryRules = (): Promise<StylometryRule[]> =>
  invokeCommand<StylometryRule[]>("get_stylometry_rules");

export const saveStylometryRules = (rules: StylometryRule[]): Promise<StylometryRule[]> =>
  invokeCommand<StylometryRule[]>("save_stylometry_rules", { rules });

export const auditChapterStylometry = (
  workspace: string,
  chapterId: string,
): Promise<StylometryReport> =>
  invokeCommand<StylometryReport>("audit_chapter_stylometry", { workspace, chapterId });

export const applyStylometrySuggestion = (
  workspace: string,
  chapterId: string,
  issue: StylometryIssue,
  replacement: string,
): Promise<void> =>
  invokeCommand<void>("apply_stylometry_suggestion", {
    workspace,
    chapterId,
    startOffset: issue.startOffset,
    endOffset: issue.endOffset,
    originalText: issue.originalText,
    replacement,
  });
