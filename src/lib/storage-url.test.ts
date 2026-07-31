import { describe, expect, it } from "vitest";
import { parseStorageUrl } from "./storage-url";

describe("parseStorageUrl", () => {
  it.each(["public", "sign", "authenticated"])("parses %s storage URLs", (kind) => {
    const result = parseStorageUrl(
      `https://backend.example/storage/v1/object/${kind}/vehicle-docs/company/vehicle/documento%20final.pdf?token=old`,
    );

    expect(result).toEqual({
      bucket: "vehicle-docs",
      path: "company/vehicle/documento final.pdf",
    });
  });

  it("rejects non-storage URLs", () => {
    expect(parseStorageUrl("https://example.com/documento.pdf")).toBeNull();
  });
});