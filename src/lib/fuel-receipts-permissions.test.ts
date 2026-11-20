import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Executes the exact deployed migration in isolated PostgreSQL memory.
// All fixture rows and file names below are fictional; production is never written.
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const company = id(1), foreignCompany = id(2), member = id(3), driver = id(4);
const station = id(5), authorization = id(6), stationUser = id(7), stranger = id(8);
const otherStation = id(9), inactiveStationUser = id(10), driverRecord = id(11);
const companyPath = `${company}/receipt.pdf`;
const foreignPath = `${foreignCompany}/receipt.pdf`;
const stationPath = `posto/${station}/${authorization}-123-receipt.pdf`;
const db = new PGlite();

async function asUser<T>(subject: string | null, action: () => Promise<T>): Promise<T> {
  await db.exec("BEGIN");
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [subject ?? ""]);
    await db.exec("SET LOCAL ROLE authenticated");
    return await action();
  } finally {
    await db.exec("ROLLBACK");
  }
}
const helper = async (path: string) => (await db.query<{ allowed: boolean }>("SELECT public.can_access_fuel_receipt($1) AS allowed", [path])).rows[0]?.allowed;
const read = async (path: string) => (await db.query("SELECT name FROM storage.objects WHERE name=$1", [path])).rows.length;
const upload = (path: string) => db.query("INSERT INTO storage.objects(bucket_id,name) VALUES ('fuel-receipts',$1)", [path]);

describe("fuel receipt permissions: exact migration with isolated PostgreSQL RLS", () => {
  beforeAll(async () => {
    await db.exec(`
      CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA storage;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
      $$;
      CREATE TABLE public.company_members(user_id uuid, company_id uuid);
      CREATE TABLE public.drivers(id uuid, user_id uuid, company_id uuid);
      CREATE TABLE public.fuel_stations(id uuid, company_id uuid);
      CREATE TABLE public.fuel_authorizations(id uuid, company_id uuid, fuel_station_id uuid, driver_id uuid);
      CREATE TABLE public.fuel_station_users(id uuid, station_id uuid, company_id uuid, active boolean);
      CREATE FUNCTION public.is_company_member(u uuid,c uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
        SELECT EXISTS(SELECT 1 FROM public.company_members WHERE user_id=u AND company_id=c)
      $$;
      CREATE TABLE storage.objects(bucket_id text, name text);
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA public,auth,storage TO authenticated;
      GRANT SELECT,INSERT,UPDATE ON storage.objects TO authenticated;
      CREATE POLICY "fuel receipts read company scoped" ON storage.objects FOR SELECT TO authenticated USING(true);
      CREATE POLICY "fuel receipts write company scoped" ON storage.objects FOR INSERT TO authenticated WITH CHECK(true);
      CREATE POLICY "fuel receipts update company scoped" ON storage.objects FOR UPDATE TO authenticated USING(true);
      INSERT INTO public.company_members VALUES ('${member}','${company}');
      INSERT INTO public.drivers VALUES ('${driverRecord}','${driver}','${company}');
      INSERT INTO public.fuel_stations VALUES ('${station}','${company}'),('${otherStation}','${foreignCompany}');
      INSERT INTO public.fuel_authorizations VALUES ('${authorization}','${company}','${station}','${driverRecord}');
      INSERT INTO public.fuel_station_users VALUES ('${stationUser}','${station}','${company}',true),('${inactiveStationUser}','${station}','${company}',false);
      INSERT INTO storage.objects VALUES ('fuel-receipts','${companyPath}'),('fuel-receipts','${foreignPath}'),('fuel-receipts','${stationPath}');
    `);
    await db.exec(readFileSync("drizzle/migrations/0001_restrict_fuel_receipts_access.sql", "utf8"));
  }, 30000);
  afterAll(async () => { await db.close(); });

  it("preserves company member SELECT, INSERT and UPDATE on company receipts", async () => {
    await asUser(member, async () => {
      expect(await read(companyPath)).toBe(1);
      await upload(`${company}/new.pdf`);
      expect(await read(`${company}/new.pdf`)).toBe(1);
      expect((await db.query("UPDATE storage.objects SET name=$1 WHERE name=$2 RETURNING name", [`${company}/renamed.pdf`,companyPath])).rows).toHaveLength(1);
    });
  });

  it("preserves registered driver SELECT, INSERT and UPDATE without requiring company membership", async () => {
    await asUser(driver, async () => {
      expect(await read(companyPath)).toBe(1);
      await upload(`${company}/driver.pdf`);
      expect(await read(`${company}/driver.pdf`)).toBe(1);
      expect((await db.query("UPDATE storage.objects SET name=$1 WHERE name=$2 RETURNING name", [`${company}/driver-renamed.pdf`,companyPath])).rows).toHaveLength(1);
    });
  });

  it("allows an active station user only on their station's matching authorization", async () => {
    await asUser(stationUser, async () => {
      expect(await read(stationPath)).toBe(1);
      expect(await read(companyPath)).toBe(0);
      const newPath = `posto/${station}/${authorization}-456-new.pdf`;
      await upload(newPath);
      expect(await read(newPath)).toBe(1);
      expect((await db.query("UPDATE storage.objects SET name=$1 WHERE name=$2 RETURNING name", [`posto/${station}/${authorization}-789-renamed.pdf`,stationPath])).rows).toHaveLength(1);
      expect(await helper(`posto/${otherStation}/${authorization}-123-receipt.pdf`)).toBe(false);
    });
  });

  it("preserves owning company and authorization driver's access to station receipts", async () => {
    for (const subject of [member,driver]) await asUser(subject, async () => {
      expect(await read(stationPath)).toBe(1);
      expect(await helper(stationPath)).toBe(true);
    });
  });

  it("denies unlinked subjects reading or updating company and station receipts", async () => {
    await asUser(stranger, async () => {
      expect((await db.query("SELECT name FROM storage.objects")).rows).toHaveLength(0);
      expect((await db.query("UPDATE storage.objects SET name='unwanted.pdf' RETURNING name")).rows).toHaveLength(0);
    });
  });

  it("denies unlinked uploads, including the former generic posto exception", async () => {
    for (const path of [companyPath,stationPath]) {
      await expect(asUser(stranger, () => upload(path))).rejects.toThrow(/row-level security/i);
    }
  });

  it("denies an inactive station account", async () => {
    await asUser(inactiveStationUser, async () => {
      expect(await read(stationPath)).toBe(0);
      expect(await helper(stationPath)).toBe(false);
    });
    await expect(asUser(inactiveStationUser, () => upload(stationPath))).rejects.toThrow(/row-level security/i);
  });

  it("checks UPDATE destinations and blocks moving a receipt to another company", async () => {
    await expect(asUser(member, () => db.query("UPDATE storage.objects SET name=$1 WHERE name=$2",[foreignPath,companyPath]))).rejects.toThrow(/row-level security/i);
    await asUser(member, async () => { expect(await read(companyPath)).toBe(1); });
  });

  it("requires the correct station and a persisted authorization before allowing posto uploads", async () => {
    for (const path of [`posto/${otherStation}/${authorization}-123-file.pdf`,`posto/${station}/${id(99)}-123-file.pdf`]) {
      await expect(asUser(stationUser, () => upload(path))).rejects.toThrow(/row-level security/i);
    }
  });

  it("denies anonymous subjects and malformed/traversal paths without casting errors", async () => {
    await asUser(null, async () => { expect(await helper(companyPath)).toBe(false); });
    await asUser(member, async () => {
      for (const path of ["", "posto", "posto/not-a-uuid/file.pdf", "invalid/file.pdf", `${company}/../file.pdf`, `${company}//file.pdf`]) {
        expect(await helper(path), path).toBe(false);
      }
    });
  });

  it("restricts function execution to authenticated/service callers, not anonymous callers", async () => {
    const result = await db.query<{ authenticated: boolean; anon: boolean }>("SELECT has_function_privilege('authenticated','public.can_access_fuel_receipt(text)','EXECUTE') AS authenticated, has_function_privilege('anon','public.can_access_fuel_receipt(text)','EXECUTE') AS anon");
    expect(result.rows[0]).toEqual({ authenticated:true, anon:false });
  });
});