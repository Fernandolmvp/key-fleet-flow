import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";

const file = readdirSync("drizzle/migrations").find((f) => f.includes("fleet_modules_additions"))!;
const sql = readFileSync(`drizzle/migrations/${file}`, "utf8").replace(/--> statement-breakpoint/g, "");

async function setup() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ select '00000000-0000-0000-0000-000000000009'::uuid $$;
    CREATE TABLE checklist_templates(id uuid primary key);
    CREATE TABLE checklist_questions(id uuid primary key);
    CREATE TABLE tires(id uuid primary key); CREATE TABLE fuel_records(id uuid primary key); CREATE TABLE trips(id uuid primary key);
    CREATE TABLE maintenance_requests(id uuid primary key default gen_random_uuid(), company_id uuid, vehicle_id uuid, driver_id uuid,
      driver_user_id uuid not null, problem_category text, problem_description text, severity_self_assessment text, km_at_report int,
      status text not null default 'pendente_aprovacao');
    CREATE TABLE checklist_runs(id uuid primary key, company_id uuid, vehicle_id uuid, driver_id uuid, km_at_check int, created_by uuid, status text);
    CREATE TABLE checklist_answers(run_id uuid, question_id uuid, question_label text, notes text, status text);
  `);
  await db.exec(sql);
  await db.exec(`
    INSERT INTO checklist_questions VALUES ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');
    UPDATE checklist_questions SET is_critical = true WHERE id = '00000000-0000-0000-0000-00000000000a';
    INSERT INTO checklist_runs VALUES ('00000000-0000-0000-0000-000000000001', gen_random_uuid(), gen_random_uuid(), null, 100, null, 'em_andamento');
  `);
  return db;
}
const count = async (db: PGlite) => (await db.query<{ c: number }>("select count(*)::int c from maintenance_requests")).rows[0].c;

describe("item crítico reprovado no checklist", () => {
  it("abre uma solicitação de manutenção crítica ao concluir, só uma vez", async () => {
    const db = await setup();
    await db.exec(`INSERT INTO checklist_answers VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000a','Freios',null,'nao_conforme')`);
    await db.exec(`UPDATE checklist_runs SET status='concluido'`);
    await db.exec(`UPDATE checklist_runs SET status='em_andamento'; UPDATE checklist_runs SET status='reprovado'`);
    expect(await count(db)).toBe(1);
    const r = (await db.query<any>("select severity_self_assessment, checklist_run_id from maintenance_requests")).rows[0];
    expect(r.severity_self_assessment).toBe("critica");
    expect(r.checklist_run_id).toBe("00000000-0000-0000-0000-000000000001");
  });
  it("item não crítico reprovado não abre solicitação", async () => {
    const db = await setup();
    await db.exec(`INSERT INTO checklist_answers VALUES ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000b','Limpeza',null,'nao_conforme')`);
    await db.exec(`UPDATE checklist_runs SET status='concluido'`);
    expect(await count(db)).toBe(0);
  });
});
