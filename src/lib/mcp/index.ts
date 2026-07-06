import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listVehiclesTool from "./tools/list-vehicles";
import listDriversTool from "./tools/list-drivers";
import getCompanyTool from "./tools/get-company";

// Issuer MUST be the direct Supabase host (built from the project ref, not
// SUPABASE_URL which may be a proxy). VITE_ vars are inlined by Vite at build
// time, keeping this import-safe (no runtime env read at module load).
const projectRef =
  import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "frotaops-mcp",
  title: "FrotaOps MCP",
  version: "0.1.0",
  instructions:
    "Ferramentas do FrotaOps: consulte a empresa do usuário, veículos e motoristas da frota. Use `get_company` para dados cadastrais, `list_vehicles` para a frota e `list_drivers` para motoristas.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getCompanyTool, listVehiclesTool, listDriversTool],
});