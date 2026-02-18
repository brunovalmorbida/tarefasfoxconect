import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export type PurchaseRequest = {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  category: string;
  urgency: string;
  estimated_value: number | null;
  status: string;
  requested_by: string;
  buyer_id: string | null;
  purchased_at: string | null;
  purchase_notes: string | null;
  actual_value: number | null;
  received_at: string | null;
  received_by: string | null;
  receive_notes: string | null;
  created_at: string;
  updated_at: string;
  requester_name?: string;
  buyer_name?: string;
};

export function usePurchases() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const purchasesQuery = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch profiles for names
      const userIds = new Set<string>();
      data.forEach((p: any) => {
        userIds.add(p.requested_by);
        if (p.buyer_id) userIds.add(p.buyer_id);
      });

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", Array.from(userIds));

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.name]) || []);

      return data.map((p: any) => ({
        ...p,
        requester_name: profileMap.get(p.requested_by) || "Desconhecido",
        buyer_name: p.buyer_id ? profileMap.get(p.buyer_id) || "Desconhecido" : null,
      })) as PurchaseRequest[];
    },
    enabled: !!user,
  });

  const createPurchase = useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      quantity: number;
      category: string;
      urgency: string;
      estimated_value?: number;
      buyer_id?: string;
    }) => {
      const { data: result, error } = await supabase
        .from("purchase_requests")
        .insert({
          ...data,
          requested_by: user!.id,
        } as any)
        .select()
        .single();
      if (error) throw error;

      // Notify
      supabase.functions.invoke("notify-purchase", {
        body: { purchaseId: result.id, action: "created" },
      });

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast({ title: "Solicitação criada com sucesso!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao criar solicitação", description: e.message, variant: "destructive" });
    },
  });

  const markAsPurchased = useMutation({
    mutationFn: async (data: {
      id: string;
      actual_value?: number;
      purchase_notes?: string;
    }) => {
      const { error } = await supabase
        .from("purchase_requests")
        .update({
          status: "purchased",
          buyer_id: user!.id,
          purchased_at: new Date().toISOString(),
          actual_value: data.actual_value,
          purchase_notes: data.purchase_notes,
        } as any)
        .eq("id", data.id);
      if (error) throw error;

      supabase.functions.invoke("notify-purchase", {
        body: { purchaseId: data.id, action: "purchased" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast({ title: "Compra registrada!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const markAsReceived = useMutation({
    mutationFn: async (data: { id: string; receive_notes?: string }) => {
      const { error } = await supabase
        .from("purchase_requests")
        .update({
          status: "received",
          received_at: new Date().toISOString(),
          received_by: user!.id,
          receive_notes: data.receive_notes,
        } as any)
        .eq("id", data.id);
      if (error) throw error;

      supabase.functions.invoke("notify-purchase", {
        body: { purchaseId: data.id, action: "received" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast({ title: "Recebimento confirmado!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const deletePurchase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("purchase_requests")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      toast({ title: "Solicitação removida!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  return {
    purchases: purchasesQuery.data || [],
    isLoading: purchasesQuery.isLoading,
    createPurchase,
    markAsPurchased,
    markAsReceived,
    deletePurchase,
  };
}
