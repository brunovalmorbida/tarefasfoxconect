import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useCallback } from "react";

export function useLogActivity() {
  const { user } = useAuth();

  const logActivity = useCallback(
    async (action: string, details?: Record<string, any>, teamId?: string) => {
      if (!user) return;
      try {
        await supabase.from("activity_log").insert({
          action,
          user_id: user.id,
          team_id: teamId ?? null,
          details: details ?? null,
        });
      } catch {
        // Silently fail - logging should not break the app
      }
    },
    [user]
  );

  return logActivity;
}
