import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SalonView } from "../SalonView";

afterEach(cleanup);

describe("SalonView", () => {
  it("invite à choisir un livre dans la Bibliothèque quand aucun n'est transmis", () => {
    render(<SalonView target={null} />);
    expect(screen.getByText(/Choisissez d'abord un livre dans la Bibliothèque/)).toBeTruthy();
  });
});
