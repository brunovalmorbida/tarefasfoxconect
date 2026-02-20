import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useIsAppAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user,
  });
}

export function useUserPermissions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCanManage(permission: "can_manage_boards" | "can_manage_columns" | "can_manage_tasks" | "can_manage_recurring_tasks" | "can_manage_purchases") {
  const { data: isAdmin } = useIsAppAdmin();
  const { data: permissions } = useUserPermissions();
  return isAdmin || (permissions?.[permission] ?? false);
}
