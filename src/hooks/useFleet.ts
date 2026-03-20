import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// Types
export interface FleetVehicle {
  id: string;
  name: string;
  plate: string;
  brand: string | null;
  model: string | null;
  year: number | null;
  current_km: number;
  city: string | null;
  status: "active" | "maintenance" | "reserve" | "inactive";
  driver_id: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FleetDriver {
  id: string;
  name: string;
  phone: string | null;
  job_title: string | null;
  city: string | null;
  vehicle_id: string | null;
  status: "active" | "inactive";
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FleetCheckin {
  id: string;
  vehicle_id: string;
  driver_id: string;
  driver_user_id: string | null;
  checkin_date: string;
  km_reported: number | null;
  needs_maintenance: boolean;
  description: string | null;
  tools_ok: boolean | null;
  tools_description: string | null;
  resolution_status: string;
  status: "pending" | "answered" | "overdue";
  task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FleetMaintenance {
  id: string;
  vehicle_id: string;
  maintenance_type: string;
  maintenance_date: string;
  km_at_maintenance: number | null;
  cost: number | null;
  supplier: string | null;
  description: string | null;
  notes: string | null;
  status: "pending" | "in_progress" | "completed";
  priority: "critical" | "attention" | "low";
  scheduled_date: string | null;
  scheduled_time: string | null;
  assigned_to: string | null;
  missing_tools: string[] | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FleetDocument {
  id: string;
  vehicle_id: string;
  maintenance_id: string | null;
  document_type: "invoice" | "warranty" | "quote" | "receipt" | "photo" | "ipva" | "insurance" | "licensing" | "other";
  title: string;
  supplier: string | null;
  document_date: string | null;
  warranty_expiry: string | null;
  notes: string | null;
  file_url: string | null;
  file_name: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Vehicles hook
export function useFleetVehicles() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: vehicles = [], isLoading } = useQuery({
    queryKey: ["fleet-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fleet_vehicles" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as FleetVehicle[];
    },
    enabled: !!user,
  });

  const createVehicle = useMutation({
    mutationFn: async (vehicle: Partial<FleetVehicle>) => {
      const { error } = await supabase
        .from("fleet_vehicles" as any)
        .insert({ ...vehicle, created_by: user?.id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-vehicles"] });
      toast.success("Veículo cadastrado com sucesso");
    },
    onError: () => toast.error("Erro ao cadastrar veículo"),
  });

  const updateVehicle = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FleetVehicle> & { id: string }) => {
      const { error } = await supabase
        .from("fleet_vehicles" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-vehicles"] });
      toast.success("Veículo atualizado");
    },
    onError: () => toast.error("Erro ao atualizar veículo"),
  });

  const deleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fleet_vehicles" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-vehicles"] });
      toast.success("Veículo removido");
    },
    onError: () => toast.error("Erro ao remover veículo"),
  });

  return { vehicles, isLoading, createVehicle, updateVehicle, deleteVehicle };
}

// Drivers hook
export function useFleetDrivers() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: drivers = [], isLoading } = useQuery({
    queryKey: ["fleet-drivers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fleet_drivers" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as FleetDriver[];
    },
    enabled: !!user,
  });

  const createDriver = useMutation({
    mutationFn: async (driver: Partial<FleetDriver>) => {
      const { error } = await supabase
        .from("fleet_drivers" as any)
        .insert({ ...driver, created_by: user?.id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-drivers"] });
      toast.success("Motorista cadastrado com sucesso");
    },
    onError: () => toast.error("Erro ao cadastrar motorista"),
  });

  const updateDriver = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FleetDriver> & { id: string }) => {
      const { error } = await supabase
        .from("fleet_drivers" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-drivers"] });
      toast.success("Motorista atualizado");
    },
    onError: () => toast.error("Erro ao atualizar motorista"),
  });

  const deleteDriver = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fleet_drivers" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-drivers"] });
      toast.success("Motorista removido");
    },
    onError: () => toast.error("Erro ao remover motorista"),
  });

  return { drivers, isLoading, createDriver, updateDriver, deleteDriver };
}

// Checkins hook
export function useFleetCheckins() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: checkins = [], isLoading } = useQuery({
    queryKey: ["fleet-checkins"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fleet_checkins" as any)
        .select("*")
        .order("checkin_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as FleetCheckin[];
    },
    enabled: !!user,
  });

  const createCheckin = useMutation({
    mutationFn: async (checkin: Partial<FleetCheckin>) => {
      const { error } = await supabase
        .from("fleet_checkins" as any)
        .insert(checkin as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-checkins"] });
      toast.success("Check-in registrado");
    },
    onError: () => toast.error("Erro ao registrar check-in"),
  });

  const updateCheckin = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FleetCheckin> & { id: string }) => {
      const { error } = await supabase
        .from("fleet_checkins" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-checkins"] });
      toast.success("Check-in atualizado");
    },
    onError: () => toast.error("Erro ao atualizar check-in"),
  });

  return { checkins, isLoading, createCheckin, updateCheckin };
}

// Maintenances hook
export function useFleetMaintenances() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: maintenances = [], isLoading } = useQuery({
    queryKey: ["fleet-maintenances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fleet_maintenances" as any)
        .select("*")
        .order("maintenance_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as FleetMaintenance[];
    },
    enabled: !!user,
  });

  const createMaintenance = useMutation({
    mutationFn: async (m: Partial<FleetMaintenance>) => {
      const { error } = await supabase
        .from("fleet_maintenances" as any)
        .insert({ ...m, created_by: user?.id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-maintenances"] });
      toast.success("Manutenção registrada");
    },
    onError: () => toast.error("Erro ao registrar manutenção"),
  });

  const updateMaintenance = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<FleetMaintenance> & { id: string }) => {
      const { error } = await supabase
        .from("fleet_maintenances" as any)
        .update(updates as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-maintenances"] });
      toast.success("Manutenção atualizada");
    },
    onError: () => toast.error("Erro ao atualizar manutenção"),
  });

  const deleteMaintenance = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fleet_maintenances" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-maintenances"] });
      toast.success("Manutenção removida");
    },
    onError: () => toast.error("Erro ao remover manutenção"),
  });

  return { maintenances, isLoading, createMaintenance, updateMaintenance, deleteMaintenance };
}

// Documents hook
export function useFleetDocuments(vehicleId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["fleet-documents", vehicleId],
    queryFn: async () => {
      let query = supabase
        .from("fleet_documents" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (vehicleId) {
        query = query.eq("vehicle_id", vehicleId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FleetDocument[];
    },
    enabled: !!user,
  });

  const createDocument = useMutation({
    mutationFn: async (doc: Partial<FleetDocument>) => {
      const { error } = await supabase
        .from("fleet_documents" as any)
        .insert({ ...doc, created_by: user?.id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-documents"] });
      toast.success("Documento adicionado");
    },
    onError: () => toast.error("Erro ao adicionar documento"),
  });

  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("fleet_documents" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fleet-documents"] });
      toast.success("Documento removido");
    },
    onError: () => toast.error("Erro ao remover documento"),
  });

  return { documents, isLoading, createDocument, deleteDocument };
}

// Upload file helper
export async function uploadFleetFile(file: File, vehicleId: string): Promise<string> {
  const fileExt = file.name.split(".").pop();
  const fileName = `${vehicleId}/${Date.now()}.${fileExt}`;
  const { error } = await supabase.storage
    .from("fleet-documents")
    .upload(fileName, file);
  if (error) throw error;
  const { data } = supabase.storage
    .from("fleet-documents")
    .getPublicUrl(fileName);
  return data.publicUrl;
}
