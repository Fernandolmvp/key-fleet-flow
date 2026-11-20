import { describe, expect, it } from "vitest";
import { currentVehicleDocuments, documentationVehiclePage } from "./documentation-list";
import { computeLicensingStatus, type DetranCalendar } from "./licensing";

describe("documentation list", () => {
  const vehicles = Array.from({ length: 61 }, (_, i) => ({ plate: `ABC${String(i).padStart(4, "0")}` }));
  it("shows exactly 25 vehicles per full page with no overlaps", () => {
    expect(documentationVehiclePage(vehicles, "", 1).rows).toEqual(vehicles.slice(0, 25));
    expect(documentationVehiclePage(vehicles, "", 2).rows).toEqual(vehicles.slice(25, 50));
    expect(documentationVehiclePage(vehicles, "", 3).rows).toEqual(vehicles.slice(50));
  });
  it("searches the entire vehicle list by plate regardless of current page", () => {
    const result = documentationVehiclePage(vehicles, "abc-0060", 3);
    expect(result.rows).toEqual([vehicles[60]]);
    expect(result.page).toBe(1);
    expect(result.total).toBe(1);
  });
  it("clamps empty and shortened result sets", () => {
    expect(documentationVehiclePage([], "", 3)).toMatchObject({ page: 1, pageCount: 1, total: 0, rows: [] });
    expect(documentationVehiclePage(vehicles.slice(0, 20), "", 3).page).toBe(1);
  });
  it("shows one latest CRLV while retaining other document types and leaving inputs unchanged", () => {
    const docs = [
      { id: "old", doc_type: "crlv", issue_date: "2025-01-01", file_url: "old.pdf" },
      { id: "new", doc_type: "crlv", issue_date: "2026-01-01", file_url: "new.pdf" },
      { id: "insurance", doc_type: "seguro", issue_date: null, file_url: null },
    ];
    expect(currentVehicleDocuments(docs).map((doc) => doc.id)).toEqual(["new", "insurance"]);
    expect(docs.map((doc) => doc.id)).toEqual(["old", "new", "insurance"]);
  });
  const calendar: DetranCalendar = new Map([
    ["SP", new Map([["leve", new Map([[4, 8]])]])],
    ["RJ", new Map([["leve", new Map([[4, 5]])]])],
  ]);
  const opts = { licensing_year: 2026, plate: "ABC1234", calendar, today: new Date(2026, 10, 20) };
  it("uses the vehicle UF calendar rather than SP", () => {
    expect(computeLicensingStatus({ ...opts, uf: " rj " })).toMatchObject({ uf: "RJ", mesAno: "05/2027" });
  });
  it("defaults missing UF to SP", () => {
    expect(computeLicensingStatus({ ...opts, uf: null })).toMatchObject({ uf: "SP", mesAno: "08/2027" });
    expect(computeLicensingStatus({ ...opts, uf: " " }).uf).toBe("SP");
  });
  it("does not silently use SP dates for another UF with no calendar", () => {
    expect(computeLicensingStatus({ ...opts, uf: "MG" })).toMatchObject({ uf: "MG", vencimento: null, status: "sem" });
  });
});