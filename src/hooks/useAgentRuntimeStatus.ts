import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AgentCommand, AgentRuntime } from "@/lib/agent";

export function useAgentRuntimeStatus(companyId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["agent-runtime-status", companyId],
    enabled: enabled && !!companyId,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_runtime_status")
        .select("*")
        .eq("company_id", companyId!)
        .maybeSingle();
      if (error) throw error;
      return (data as AgentRuntime | null) ?? null;
    },
  });
}

export function useAgentCommand(companyId: string) {
  const queryClient = useQueryClient();

  return async (command: AgentCommand) => {
    const { data, error } = await supabase
      .from("agent_runtime_status")
      .update({ pending_command: command })
      .eq("company_id", companyId)
      .select("company_id");
    if (error) throw error;

    if (!data?.length) {
      const { error: insertError } = await supabase
        .from("agent_runtime_status")
        .insert({ company_id: companyId, pending_command: command });
      if (insertError && insertError.code !== "23505") throw insertError;
      if (insertError?.code === "23505") {
        const { error: retryError } = await supabase
          .from("agent_runtime_status")
          .update({ pending_command: command })
          .eq("company_id", companyId);
        if (retryError) throw retryError;
      }
    }

    await queryClient.invalidateQueries({ queryKey: ["agent-runtime-status", companyId] });
  };
}
