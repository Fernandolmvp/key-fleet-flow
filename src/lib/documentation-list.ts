export const DOCUMENTATION_PAGE_SIZE = 25;

export function documentationVehiclePage<T extends { plate: string }>(vehicles: T[], search: string, requestedPage: number) {
  const query = search.toUpperCase().replace(/[\s-]/g, "");
  const filtered = vehicles.filter((vehicle) => vehicle.plate.toUpperCase().replace(/[\s-]/g, "").includes(query));
  const pageCount = Math.max(1, Math.ceil(filtered.length / DOCUMENTATION_PAGE_SIZE));
  const page = Math.max(1, Math.min(pageCount, requestedPage));
  const start = (page - 1) * DOCUMENTATION_PAGE_SIZE;
  return { rows: filtered.slice(start, start + DOCUMENTATION_PAGE_SIZE), total: filtered.length, pageCount, page, start };
}

/** Show one current CRLV per vehicle; historical records remain unchanged in storage. */
export function currentVehicleDocuments<T extends { id: string; doc_type: string; issue_date: string | null; created_at?: string; file_url: string | null }>(docs: T[]): T[] {
  const crlvs = docs.filter((doc) => doc.doc_type === "crlv");
  const current = [...crlvs].sort((a, b) =>
    (b.issue_date ?? "").localeCompare(a.issue_date ?? "") ||
    (b.created_at ?? "").localeCompare(a.created_at ?? "") ||
    Number(Boolean(b.file_url)) - Number(Boolean(a.file_url)) || a.id.localeCompare(b.id)
  )[0];
  return docs.filter((doc) => doc.doc_type !== "crlv" || doc.id === current?.id);
}