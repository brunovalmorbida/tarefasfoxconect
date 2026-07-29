import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CITIES } from "@/lib/techSchedule";

export function useTechColumnOrder() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["tech-column-order"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tech_column_order").select("city, technicians");
      if (error) throw error;
      const map = new Map<string, string[]>();
      data.forEach((row) => map.set(row.city, row.technicians ?? []));
      return map;
    },
  });

  const saveOrder = useMutation({
    mutationFn: async ({ city, technicians }: { city: string; technicians: string[] }) => {
      const { error } = await supabase
        .from("tech_column_order")
        .upsert({ city, technicians }, { onConflict: "city" });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tech-column-order"] }),
  });

  /** Saved order first (only known technicians), then any new technician from config. */
  const getTechnicians = (cityName: string) => {
    const config = CITIES.find((c) => c.name === cityName)?.technicians ?? [];
    const saved = query.data?.get(cityName) ?? [];
    const ordered = saved.filter((t) => config.includes(t));
    return [...ordered, ...config.filter((t) => !ordered.includes(t))];
  };

  return { getTechnicians, saveOrder, isLoading: query.isLoading };
}
