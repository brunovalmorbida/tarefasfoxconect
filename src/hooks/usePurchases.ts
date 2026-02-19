import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export type PurchaseListItem = {
  id: string;
  list_id: string;
  name: string;
  quantity: number;
  category: string;
  estimated_value: number | null;
  actual_value: number | null;
  description: string | null;
  status: string;
};

export type PurchaseList = {
  id: string;
  title: string;
  status: string;
  urgency: string;
  requested_by: string;
  buyer_id: string | null;
  purchased_at: string | null;
  purchase_notes: string | null;
  received_at: string | null;
  received_by: string | null;
  receive_notes: string | null;
  created_at: string;
  updated_at: string;
  items: PurchaseListItem[];
  requester_name?: string;
  buyer_name?: string;
};

export function usePurchases() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const purchasesQuery = useQuery({
    queryKey: ["purchase-lists"],
    queryFn: async () => {
      const { data: lists, error } = await supabase
        .from("purchase_lists")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const listIds = lists.map((l: any) => l.id);
      const { data: items } = listIds.length > 0
        ? await supabase.from("purchase_list_items").select("*").in("list_id", listIds)
        : { data: [] };

      const userIds = new Set<string>();
      lists.forEach((l: any) => {
        userIds.add(l.requested_by);
        if (l.buyer_id) userIds.add(l.buyer_id);
      });

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", Array.from(userIds));

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.name]) || []);
      const itemsByList = new Map<string, PurchaseListItem[]>();
      (items || []).forEach((item: any) => {
        if (!itemsByList.has(item.list_id)) itemsByList.set(item.list_id, []);
        itemsByList.get(item.list_id)!.push(item);
      });

      return lists.map((l: any) => ({
        ...l,
        items: itemsByList.get(l.id) || [],
        requester_name: profileMap.get(l.requested_by) || "Desconhecido",
        buyer_name: l.buyer_id ? profileMap.get(l.buyer_id) || "Desconhecido" : null,
      })) as PurchaseList[];
    },
    enabled: !!user,
  });

  const createList = useMutation({
    mutationFn: async (data: {
      title: string;
      urgency: string;
      buyer_id?: string;
      items: Array<{ name: string; quantity: number; category: string; estimated_value?: number; description?: string }>;
    }) => {
      const { data: list, error } = await supabase
        .from("purchase_lists")
        .insert({
          title: data.title,
          urgency: data.urgency,
          requested_by: user!.id,
          buyer_id: data.buyer_id,
        } as any)
        .select()
        .single();
      if (error) throw error;

      const rows = data.items.map((item) => ({ ...item, list_id: list.id }));
      const { error: itemsError } = await supabase
        .from("purchase_list_items")
        .insert(rows as any);
      if (itemsError) throw itemsError;

      supabase.functions.invoke("notify-purchase", {
        body: { listId: list.id, action: "created" },
      });

      return list;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-lists"] });
      toast({ title: "Lista de compras criada!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro ao criar lista", description: e.message, variant: "destructive" });
    },
  });

  const updateListStatusFromItems = async (listId: string) => {
    // Fetch all items for this list to determine overall status
    const { data: allItems } = await supabase
      .from("purchase_list_items")
      .select("status")
      .eq("list_id", listId);

    if (!allItems || allItems.length === 0) return;

    const allReceived = allItems.every((i: any) => i.status === "received");
    const allPurchasedOrReceived = allItems.every((i: any) => i.status === "purchased" || i.status === "received");
    const somePurchased = allItems.some((i: any) => i.status === "purchased" || i.status === "received");

    let newStatus = "pending";
    if (allReceived) {
      newStatus = "received";
    } else if (allPurchasedOrReceived) {
      newStatus = "purchased";
    } else if (somePurchased) {
      newStatus = "purchased";
    }

    await supabase
      .from("purchase_lists")
      .update({
        status: newStatus,
        ...(newStatus === "received" ? { received_at: new Date().toISOString(), received_by: user!.id } : {}),
        ...(newStatus === "purchased" && !somePurchased ? { purchased_at: new Date().toISOString(), buyer_id: user!.id } : {}),
      } as any)
      .eq("id", listId);
  };

  const markItemPurchased = useMutation({
    mutationFn: async (data: { itemId: string; listId: string; actual_value?: number }) => {
      const { error } = await supabase
        .from("purchase_list_items")
        .update({
          status: "purchased",
          ...(data.actual_value ? { actual_value: data.actual_value } : {}),
        } as any)
        .eq("id", data.itemId);
      if (error) throw error;

      await updateListStatusFromItems(data.listId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-lists"] });
      toast({ title: "Item marcado como comprado!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const markItemReceived = useMutation({
    mutationFn: async (data: { itemId: string; listId: string }) => {
      const { error } = await supabase
        .from("purchase_list_items")
        .update({ status: "received" } as any)
        .eq("id", data.itemId);
      if (error) throw error;

      await updateListStatusFromItems(data.listId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-lists"] });
      toast({ title: "Item marcado como recebido!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const markAsPurchased = useMutation({
    mutationFn: async (data: { id: string; purchase_notes?: string; item_values?: Record<string, number> }) => {
      const { error } = await supabase
        .from("purchase_lists")
        .update({
          status: "purchased",
          buyer_id: user!.id,
          purchased_at: new Date().toISOString(),
          purchase_notes: data.purchase_notes,
        } as any)
        .eq("id", data.id);
      if (error) throw error;

      // Update all items to purchased + individual values
      await supabase.from("purchase_list_items").update({ status: "purchased" } as any).eq("list_id", data.id);

      if (data.item_values) {
        for (const [itemId, value] of Object.entries(data.item_values)) {
          if (value) {
            await supabase.from("purchase_list_items").update({ actual_value: value } as any).eq("id", itemId);
          }
        }
      }

      supabase.functions.invoke("notify-purchase", {
        body: { listId: data.id, action: "purchased" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-lists"] });
      toast({ title: "Compra registrada!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const markAsReceived = useMutation({
    mutationFn: async (data: { id: string; receive_notes?: string }) => {
      const { error } = await supabase
        .from("purchase_lists")
        .update({
          status: "received",
          received_at: new Date().toISOString(),
          received_by: user!.id,
          receive_notes: data.receive_notes,
        } as any)
        .eq("id", data.id);
      if (error) throw error;

      // Mark all items as received
      await supabase.from("purchase_list_items").update({ status: "received" } as any).eq("list_id", data.id);

      supabase.functions.invoke("notify-purchase", {
        body: { listId: data.id, action: "received" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-lists"] });
      toast({ title: "Recebimento confirmado!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  const deleteList = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_lists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-lists"] });
      toast({ title: "Lista removida!" });
    },
    onError: (e: any) => {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    },
  });

  return {
    purchases: purchasesQuery.data || [],
    isLoading: purchasesQuery.isLoading,
    createList,
    markAsPurchased,
    markAsReceived,
    markItemPurchased,
    markItemReceived,
    deleteList,
  };
}
