import { describe, expect, it } from "vitest";
import { isValidPlate, plateSchema } from "./plate";
import { areSimilarPlates, fuelDriverSchema, looksLikeCompanyName, similarRegisteredPlates } from "./form-validation";

describe("clean form inputs", () => {
  it("accepts the old ABC1234 format", () => expect(isValidPlate("ABC1234")).toBe(true));
  it("accepts Mercosul ABC1D23", () => expect(isValidPlate("ABC1D23")).toBe(true));
  it("rejects invalid positions, length and injected punctuation", () => {
    for (const plate of ["AB12345", "ABCD123", "ABC1DD3", "ABC123", "ABC12345", "ABC!1234", ""]) {
      expect(isValidPlate(plate), plate).toBe(false);
    }
    expect(plateSchema.parse(" abc-1234 ")).toBe("ABC1234");
  });
  it("warns for one-character differences and equivalent old/Mercosul plates", () => {
    expect(areSimilarPlates("ABC1234", "ABC1235")).toBe(true);
    expect(areSimilarPlates("ABC1234", "ABC1C34")).toBe(true);
    expect(areSimilarPlates("ABC1234", "XYZ1234")).toBe(false);
  });
  it("warns for adjacent transposed digits", () => expect(areSimilarPlates("ABC1234", "ABC1243")).toBe(true));
  it("ignores the edited vehicle, but includes duplicates in other vehicles", () => {
    expect(similarRegisteredPlates("ABC1234", [{ id: "self", plate: "ABC1234" }, { id: "other", plate: "ABC1235" }], "self").map((row) => row.id)).toEqual(["other"]);
  });
  it("requires a valid driver selection for fuel records", () => {
    expect(fuelDriverSchema.safeParse("").success).toBe(false);
    expect(fuelDriverSchema.safeParse(null).success).toBe(false);
    expect(fuelDriverSchema.safeParse("not-a-driver").success).toBe(false);
    expect(fuelDriverSchema.safeParse("123e4567-e89b-42d3-a456-426614174000").success).toBe(true);
  });
  it("recognizes LTDA, ME and EIRELI as whole words without false personal-name matches", () => {
    for (const name of ["Transportes LTDA", "Empresa ME", "Empresa EIRELI", "empresa ltda."]) expect(looksLikeCompanyName(name)).toBe(true);
    for (const name of ["Fernando Volpi", "Maria Mendes", "Meire Silva", "Almeida"]) expect(looksLikeCompanyName(name)).toBe(false);
  });
});