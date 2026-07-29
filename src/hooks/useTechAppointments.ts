import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type TechAppointment = Tables<"tech_appointments">;

export function useTechAppointments(forwarded = false) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["tech-appointments", forwarded],
    queryFn: async () => {
      let q = supabase.from("tech_appointments").select("*");
      q = forwarded
        ? q.not("forwarded_at", "is", null).order("forwarded_at", { ascending: false })
        : q.is("forwarded_at", null).order("scheduled_date").order("position");
      const { data, error } = await q;
      if (error) throw error;
      return data as TechAppointment[];
    },
    enabled: !!user,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["tech-appointments"] });

  const createAppointment = useMutation({
    mutationFn: async (values: Omit<TablesInsert<"tech_appointments">, "created_by">) => {
      const { error } = await supabase
        .from("tech_appointments")
        .insert({ ...values, created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateAppointment = useMutation({
    mutationFn: async ({ id, ...values }: { id: string } & Partial<TablesInsert<"tech_appointments">>) => {
      const { error } = await supabase.from("tech_appointments").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tech_appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const forwardAppointment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tech_appointments")
        .update({ forwarded_at: new Date().toISOString(), forwarded_by: user!.id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: async (
      updates: { id: string; technician: string | null; weekday: number | null; position: number }[]
    ) => {
      const results = await Promise.all(
        updates.map((u) =>
          supabase
            .from("tech_appointments")
            .update({ technician: u.technician, weekday: u.weekday, position: u.position })
            .eq("id", u.id)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: invalidate,
  });


  useEffect(() => {
    const channel = supabase
      .channel("tech-appointments-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tech_appointments" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tech-appointments"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return {
    appointments: query.data ?? [],
    isLoading: query.isLoading,
    createAppointment,
    updateAppointment,
    deleteAppointment,
    forwardAppointment,
    reorder,
  };
}

export function useProfilesMap() {
  return useQuery({
    queryKey: ["profiles-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, name");
      if (error) throw error;
      return new Map(data.map((p) => [p.user_id, p.name]));
    },
  });
}
