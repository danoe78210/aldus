import { describe, expect, it } from "vitest";
import { compareSourcePaths, workspaceFilePath } from "../sources";

describe("sources", () => {
  it("sorts relative paths naturally", () => {
    expect(["Chapitres/10.md", "Chapitres/2.md", "annexe.md"].sort(compareSourcePaths)).toEqual([
      "annexe.md",
      "Chapitres/2.md",
      "Chapitres/10.md",
    ]);
  });

  it("joins workspace paths with the root separator", () => {
    expect(workspaceFilePath("C:\\Projet\\", "Images/a.png")).toBe("C:\\Projet\\Images\\a.png");
    expect(workspaceFilePath("/home/projet", "Images/a.png")).toBe("/home/projet/Images/a.png");
  });
});
