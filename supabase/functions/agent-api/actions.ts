import type { AgentContext } from "./helpers.ts";
import { readActions } from "./read-actions.ts";
import { driverActions } from "./driver-actions.ts";
import { managerActions } from "./manager-actions.ts";
import { agenteStatus } from "./runtime-actions.ts";

const actions: Record<string, (ctx: AgentContext, params: Record<string, unknown>) => Promise<any>> = {
  ...readActions,
  ...driverActions,
  ...managerActions,
  agente_status: agenteStatus,
};

export function actionHandler(action: string) {
  return actions[action] ?? null;
}
