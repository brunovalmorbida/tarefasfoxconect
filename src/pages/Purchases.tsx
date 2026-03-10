import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { usePurchases, PurchaseList } from "@/hooks/usePurchases";
import { useAuth } from "@/hooks/useAuth";
import { useIsAppAdmin, useCanManage } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ShoppingCart, PackageCheck, Trash2, Clock, X, ChevronDown, ChevronUp, Check, Pencil } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const urgencyColors: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};
const urgencyLabels: Record<string, string> = { low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" };
const categoryLabels: Record<string, string> = {
  office: "Escritório", cleaning: "Limpeza", technology: "Tecnologia",
  maintenance: "Manutenção", food: "Alimentação", other: "Outros",
};
const statusLabels: Record<string, string> = { pending: "Pendente", purchased: "Comprado", received: "Recebido" };
const statusColors: Record<string, string> = {
  pending: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  purchased: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  received: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

type ListItem = { name: string; quantity: string; category: string; estimated_value: string; description: string };
const emptyItem = (): ListItem => ({ name: "", quantity: "1", category: "other", estimated_value: "", description: "" });

export default function Purchases() {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAppAdmin();
  const canViewPurchases = useCanManage("can_view_purchases");
  const { purchases, isLoading, createList, updateList, markAsPurchased, markAsReceived, markItemPurchased, markItemReceived, deleteList } = usePurchases();
  const { toast } = useToast();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState<PurchaseList | null>(null);
  const [showReceiveDialog, setShowReceiveDialog] = useState<PurchaseList | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showEditDialog, setShowEditDialog] = useState<PurchaseList | null>(null);

  // Edit form
  const [editTitle, setEditTitle] = useState("");
  const [editUrgency, setEditUrgency] = useState("medium");
  const [editBuyerId, setEditBuyerId] = useState("");
  const [editItems, setEditItems] = useState<ListItem[]>([emptyItem()]);

  // Create form
  const [newTitle, setNewTitle] = useState("Lista de Compras");
  const [newUrgency, setNewUrgency] = useState("medium");
  const [newBuyerId, setNewBuyerId] = useState("");
  const [listItems, setListItems] = useState<ListItem[]>([emptyItem()]);

  // Purchase form
  const [purchaseNotes, setPurchaseNotes] = useState("");
  const [itemValues, setItemValues] = useState<Record<string, string>>({});

  // Receive form
  const [receiveNotes, setReceiveNotes] = useState("");

  const { data: allProfiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name");
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch users with can_be_buyer permission or admin role for buyer selection
  const { data: buyerProfiles = [] } = useQuery({
    queryKey: ["buyer-profiles"],
    queryFn: async () => {
      // Get user IDs that have can_be_buyer permission
      const { data: perms } = await supabase
        .from("user_permissions")
        .select("user_id")
        .eq("can_be_buyer", true);
      const buyerIds = new Set((perms || []).map((p: any) => p.user_id));

      // Get admin user IDs
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");
      (admins || []).forEach((a: any) => buyerIds.add(a.user_id));

      if (buyerIds.size === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", Array.from(buyerIds));
      return profiles || [];
    },
    enabled: !!user,
  });

  const { data: productCatalog = [] } = useQuery({
    queryKey: ["product-catalog"],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_catalog")
        .select("*, product_categories(name)")
        .order("name");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: productCategories = [] } = useQuery({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("product_categories").select("*").order("name");
      return data || [];
    },
    enabled: !!user,
  });

  // Map custom categories to the select - merge with fixed ones
  const allCategoryLabels: Record<string, string> = { ...categoryLabels };
  productCategories.forEach((c: any) => {
    allCategoryLabels[c.id] = c.name;
  });

  const [openProductPopover, setOpenProductPopover] = useState<number | null>(null);

  const updateEditItem = (i: number, field: keyof ListItem, value: string) => {
    setEditItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const openEdit = (list: PurchaseList) => {
    setEditTitle(list.title);
    setEditUrgency(list.urgency);
    setEditBuyerId(list.buyer_id || "");
    setEditItems(list.items.map((i) => ({
      name: i.name,
      quantity: String(i.quantity),
      category: i.category,
      estimated_value: i.estimated_value ? String(i.estimated_value) : "",
      description: i.description || "",
    })));
    setShowEditDialog(list);
  };

  const handleEdit = () => {
    if (!showEditDialog) return;
    const valid = editItems.filter((i) => i.name.trim());
    if (!valid.length) return;
    if (!editBuyerId) {
      toast({ title: "Selecione um comprador", variant: "destructive" });
      return;
    }
    updateList.mutate({
      id: showEditDialog.id,
      title: editTitle.trim() || "Lista de Compras",
      urgency: editUrgency,
      buyer_id: editBuyerId,
      items: valid.map((i) => ({
        name: i.name.trim(),
        quantity: parseInt(i.quantity) || 1,
        category: i.category,
        estimated_value: i.estimated_value ? parseFloat(i.estimated_value) : undefined,
        description: i.description.trim() || undefined,
      })),
    }, {
      onSuccess: () => setShowEditDialog(null),
    });
  };

  const updateItem = (i: number, field: keyof ListItem, value: string) => {
    setListItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const handleCreate = () => {
    const valid = listItems.filter((i) => i.name.trim());
    if (!valid.length) return;
    if (!newBuyerId) {
      toast({ title: "Selecione um comprador", variant: "destructive" });
      return;
    }
    createList.mutate({
      title: newTitle.trim() || "Lista de Compras",
      urgency: newUrgency,
      buyer_id: newBuyerId,
      items: valid.map((i) => ({
        name: i.name.trim(),
        quantity: parseInt(i.quantity) || 1,
        category: i.category,
        estimated_value: i.estimated_value ? parseFloat(i.estimated_value) : undefined,
        description: i.description.trim() || undefined,
      })),
    }, {
      onSuccess: () => {
        setShowCreateDialog(false);
        setListItems([emptyItem()]);
        setNewTitle("Lista de Compras");
        setNewUrgency("medium");
        setNewBuyerId("");
      },
    });
  };

  const handlePurchase = () => {
    if (!showPurchaseDialog) return;
    const values: Record<string, number> = {};
    Object.entries(itemValues).forEach(([k, v]) => { if (v) values[k] = parseFloat(v); });
    markAsPurchased.mutate({
      id: showPurchaseDialog.id,
      purchase_notes: purchaseNotes.trim() || undefined,
      item_values: Object.keys(values).length > 0 ? values : undefined,
    }, {
      onSuccess: () => { setShowPurchaseDialog(null); setPurchaseNotes(""); setItemValues({}); },
    });
  };

  const handleReceive = () => {
    if (!showReceiveDialog) return;
    markAsReceived.mutate({
      id: showReceiveDialog.id,
      receive_notes: receiveNotes.trim() || undefined,
    }, {
      onSuccess: () => { setShowReceiveDialog(null); setReceiveNotes(""); },
    });
  };

  const pending = purchases.filter((p) => p.status === "pending");
  const purchased = purchases.filter((p) => p.status === "purchased");
  const received = purchases.filter((p) => p.status === "received");

  const totalEstimated = (list: PurchaseList) =>
    list.items.reduce((s, i) => s + (Number(i.estimated_value) || 0), 0);
  const totalActual = (list: PurchaseList) =>
    list.items.reduce((s, i) => s + (Number(i.actual_value) || 0), 0);

  const itemStatusIcon = (status: string) => {
    if (status === "received") return <Check className="h-3 w-3 text-green-600" />;
    if (status === "purchased") return <ShoppingCart className="h-3 w-3 text-amber-600" />;
    return <Clock className="h-3 w-3 text-muted-foreground" />;
  };

  const renderCard = (list: PurchaseList) => {
    const isExpanded = expandedId === list.id;
    const pendingItems = list.items.filter(i => i.status === "pending").length;
    const purchasedItems = list.items.filter(i => i.status === "purchased").length;
    const receivedItems = list.items.filter(i => i.status === "received").length;

    return (
      <Card key={list.id} className="relative">
        <CardContent className="pt-4 pb-3 px-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-semibold text-sm leading-tight truncate">{list.title}</h3>
              <span className="text-xs text-muted-foreground shrink-0">({list.items.length} itens)</span>
            </div>
            <div className="flex gap-1 shrink-0">
              <Badge className={`text-[10px] px-1.5 py-0 ${urgencyColors[list.urgency]}`}>{urgencyLabels[list.urgency]}</Badge>
              <Badge className={`text-[10px] px-1.5 py-0 ${statusColors[list.status]}`}>{statusLabels[list.status]}</Badge>
            </div>
          </div>

          {/* Summary */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {totalEstimated(list) > 0 && <span>💰 Est: R$ {totalEstimated(list).toFixed(2)}</span>}
            {totalActual(list) > 0 && <span>💰 Real: R$ {totalActual(list).toFixed(2)}</span>}
            <span>👤 {list.requester_name}</span>
            {list.buyer_name && <span>🛍️ {list.buyer_name}</span>}
          </div>

          {/* Item progress */}
          <div className="flex gap-3 text-[10px] text-muted-foreground">
            {pendingItems > 0 && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {pendingItems} pendente(s)</span>}
            {purchasedItems > 0 && <span className="flex items-center gap-1"><ShoppingCart className="h-3 w-3 text-amber-600" /> {purchasedItems} comprado(s)</span>}
            {receivedItems > 0 && <span className="flex items-center gap-1"><Check className="h-3 w-3 text-green-600" /> {receivedItems} recebido(s)</span>}
          </div>

          {/* Expand/collapse items */}
          <Button
            variant="ghost" size="sm"
            className="text-xs h-6 px-2 text-muted-foreground"
            onClick={() => setExpandedId(isExpanded ? null : list.id)}
          >
            {isExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            {isExpanded ? "Ocultar itens" : "Ver itens"}
          </Button>

          {isExpanded && (
            <div className="border rounded-md divide-y text-xs">
              {list.items.map((item, i) => (
                <div key={item.id} className="px-3 py-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {itemStatusIcon(item.status)}
                    <div className="min-w-0">
                      <span className="font-medium">{i + 1}. {item.name}</span>
                      <span className="text-muted-foreground ml-2">x{item.quantity} · {allCategoryLabels[item.category] || categoryLabels[item.category] || item.category}</span>
                      {item.description && <span className="text-muted-foreground ml-1">· {item.description}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-muted-foreground">
                      {item.actual_value ? `R$ ${Number(item.actual_value).toFixed(2)}` : item.estimated_value ? `Est: R$ ${Number(item.estimated_value).toFixed(2)}` : ""}
                    </span>
                    {item.status === "pending" && (
                      <Button
                        size="sm" variant="outline"
                        className="text-[10px] h-6 px-2"
                        onClick={() => markItemPurchased.mutate({ itemId: item.id, listId: list.id })}
                        disabled={markItemPurchased.isPending}
                      >
                        <ShoppingCart className="h-3 w-3 mr-1" /> Comprado
                      </Button>
                    )}
                    {item.status === "purchased" && (
                      <Button
                        size="sm" variant="outline"
                        className="text-[10px] h-6 px-2"
                        onClick={() => markItemReceived.mutate({ itemId: item.id, listId: list.id })}
                        disabled={markItemReceived.isPending}
                      >
                        <PackageCheck className="h-3 w-3 mr-1" /> Recebido
                      </Button>
                    )}
                    {item.status === "received" && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">✓</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {format(new Date(list.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </div>

          <div className="flex gap-1 pt-1">
            {list.status === "pending" && (isAdmin || list.requested_by === user?.id) && (
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => openEdit(list)}>
                <Pencil className="h-3 w-3 mr-1" /> Editar
              </Button>
            )}
            {list.status === "pending" && (
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => {
                const vals: Record<string, string> = {};
                list.items.forEach((i) => { vals[i.id] = i.estimated_value?.toString() || ""; });
                setItemValues(vals);
                setShowPurchaseDialog(list);
              }}>
                <ShoppingCart className="h-3 w-3 mr-1" /> Tudo Comprado
              </Button>
            )}
            {list.status === "purchased" && (list.requested_by === user?.id || isAdmin) && (
              <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowReceiveDialog(list)}>
                <PackageCheck className="h-3 w-3 mr-1" /> Tudo Recebido
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" variant="ghost" className="text-xs h-7 text-destructive hover:text-destructive" onClick={() => deleteList.mutate(list.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;

  if (!isAdmin && !canViewPurchases) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Você não tem permissão para acessar esta página.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Compras</h1>
        <Button onClick={() => setShowCreateDialog(true)}><Plus className="h-4 w-4 mr-2" />Nova Lista</Button>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pendentes ({pending.length})</TabsTrigger>
          <TabsTrigger value="purchased">Comprados ({purchased.length})</TabsTrigger>
          <TabsTrigger value="received">Recebidos ({received.length})</TabsTrigger>
          <TabsTrigger value="all">Todos ({purchases.length})</TabsTrigger>
        </TabsList>
        {["pending", "purchased", "received", "all"].map((tab) => {
          const data = tab === "all" ? purchases : tab === "pending" ? pending : tab === "purchased" ? purchased : received;
          return (
            <TabsContent key={tab} value={tab} className="mt-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.length === 0 ? <p className="text-muted-foreground col-span-full">Nenhuma lista.</p> : data.map(renderCard)}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Lista de Compras</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Label>Título</Label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </div>
              <div>
                <Label>Urgência</Label>
                <Select value={newUrgency} onValueChange={setNewUrgency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(urgencyLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Comprador <span className="text-destructive">*</span></Label>
                <Select value={newBuyerId} onValueChange={setNewBuyerId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {buyerProfiles.map((p: any) => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Itens ({listItems.length})</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setListItems((p) => [...p, emptyItem()])}>
                  <Plus className="h-3 w-3 mr-1" /> Item
                </Button>
              </div>
              {listItems.map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-5 gap-2">
                      <div className="col-span-2">
                        <Popover open={openProductPopover === i} onOpenChange={(open) => setOpenProductPopover(open ? i : null)}>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="h-8 text-sm w-full justify-start font-normal truncate">
                              {item.name || <span className="text-muted-foreground">Selecionar produto...</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[280px]" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar produto..." />
                              <CommandList>
                                <CommandEmpty>Nenhum produto encontrado. Cadastre no catálogo.</CommandEmpty>
                                <CommandGroup heading="Catálogo">
                                  {productCatalog.map((p: any) => (
                                    <CommandItem
                                      key={p.id}
                                      value={p.name}
                                      onSelect={() => {
                                        const catId = p.category_id || "other";
                                        updateItem(i, "name", p.name);
                                        updateItem(i, "category", catId);
                                        if (p.default_estimated_value) {
                                          updateItem(i, "estimated_value", String(p.default_estimated_value));
                                        }
                                        setOpenProductPopover(null);
                                      }}
                                    >
                                      <div className="flex flex-col">
                                        <span>{p.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {p.product_categories?.name || "Sem categoria"}
                                          {p.default_estimated_value ? ` · R$ ${Number(p.default_estimated_value).toFixed(2)}` : ""}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, "quantity", e.target.value)} placeholder="Qtd" className="h-8 text-sm" />
                      <Select value={item.category} onValueChange={(v) => updateItem(i, "category", v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(allCategoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" step="0.01" value={item.estimated_value} onChange={(e) => updateItem(i, "estimated_value", e.target.value)} placeholder="R$" className="h-8 text-sm" />
                    </div>
                    {listItems.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => setListItems((p) => p.filter((_, idx) => idx !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(i, "description", e.target.value)}
                    placeholder="Observação do item (opcional)"
                    className="h-7 text-xs text-muted-foreground ml-0"
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!listItems.some((i) => i.name.trim()) || createList.isPending}>
              {createList.isPending ? "Criando..." : `Criar Lista (${listItems.filter((i) => i.name.trim()).length} itens)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!showEditDialog} onOpenChange={(open) => { if (!open) setShowEditDialog(null); }}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Lista de Compras</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Label>Título</Label>
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
              </div>
              <div>
                <Label>Urgência</Label>
                <Select value={editUrgency} onValueChange={setEditUrgency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(urgencyLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Comprador <span className="text-destructive">*</span></Label>
                <Select value={editBuyerId} onValueChange={setEditBuyerId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {buyerProfiles.map((p: any) => <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Itens ({editItems.length})</Label>
                <Button type="button" variant="outline" size="sm" onClick={() => setEditItems((p) => [...p, emptyItem()])}>
                  <Plus className="h-3 w-3 mr-1" /> Item
                </Button>
              </div>
              {editItems.map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 grid grid-cols-5 gap-2">
                      <div className="col-span-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="h-8 text-sm w-full justify-start font-normal truncate">
                              {item.name || <span className="text-muted-foreground">Selecionar produto...</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[280px]" align="start">
                            <Command>
                              <CommandInput placeholder="Buscar produto..." />
                              <CommandList>
                                <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                                <CommandGroup heading="Catálogo">
                                  {productCatalog.map((p: any) => (
                                    <CommandItem
                                      key={p.id}
                                      value={p.name}
                                      onSelect={() => {
                                        const catId = p.category_id || "other";
                                        updateEditItem(i, "name", p.name);
                                        updateEditItem(i, "category", catId);
                                        if (p.default_estimated_value) {
                                          updateEditItem(i, "estimated_value", String(p.default_estimated_value));
                                        }
                                      }}
                                    >
                                      <div className="flex flex-col">
                                        <span>{p.name}</span>
                                        <span className="text-xs text-muted-foreground">
                                          {p.product_categories?.name || "Sem categoria"}
                                          {p.default_estimated_value ? ` · R$ ${Number(p.default_estimated_value).toFixed(2)}` : ""}
                                        </span>
                                      </div>
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                      <Input type="number" min="1" value={item.quantity} onChange={(e) => updateEditItem(i, "quantity", e.target.value)} placeholder="Qtd" className="h-8 text-sm" />
                      <Select value={item.category} onValueChange={(v) => updateEditItem(i, "category", v)}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(allCategoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" step="0.01" value={item.estimated_value} onChange={(e) => updateEditItem(i, "estimated_value", e.target.value)} placeholder="R$" className="h-8 text-sm" />
                    </div>
                    {editItems.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => setEditItems((p) => p.filter((_, idx) => idx !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <Input
                    value={item.description}
                    onChange={(e) => updateEditItem(i, "description", e.target.value)}
                    placeholder="Observação do item (opcional)"
                    className="h-7 text-xs text-muted-foreground ml-0"
                  />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={!editItems.some((i) => i.name.trim()) || updateList.isPending}>
              {updateList.isPending ? "Salvando..." : `Salvar Alterações (${editItems.filter((i) => i.name.trim()).length} itens)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase All Dialog */}
      <Dialog open={!!showPurchaseDialog} onOpenChange={() => setShowPurchaseDialog(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar Compra (Todos)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Lista: <strong>{showPurchaseDialog?.title}</strong></p>
            <div className="space-y-2">
              <Label className="text-sm">Valor real por item:</Label>
              {showPurchaseDialog?.items.map((item, i) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">{i + 1}. {item.name} (x{item.quantity})</span>
                  <Input
                    type="number" step="0.01" placeholder="R$"
                    className="w-28 h-8 text-sm"
                    value={itemValues[item.id] || ""}
                    onChange={(e) => setItemValues((p) => ({ ...p, [item.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={purchaseNotes} onChange={(e) => setPurchaseNotes(e.target.value)} placeholder="Onde comprou, nota fiscal..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPurchaseDialog(null)}>Cancelar</Button>
            <Button onClick={handlePurchase} disabled={markAsPurchased.isPending}>
              {markAsPurchased.isPending ? "Salvando..." : "Confirmar Compra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive All Dialog */}
      <Dialog open={!!showReceiveDialog} onOpenChange={() => setShowReceiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Confirmar Recebimento (Todos)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Lista: <strong>{showReceiveDialog?.title}</strong></p>
            <div className="border rounded-md divide-y text-xs">
              {showReceiveDialog?.items.map((item, i) => (
                <div key={item.id} className="px-3 py-1.5">{i + 1}. {item.name} (x{item.quantity})</div>
              ))}
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={receiveNotes} onChange={(e) => setReceiveNotes(e.target.value)} placeholder="Condição, conferência..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiveDialog(null)}>Cancelar</Button>
            <Button onClick={handleReceive} disabled={markAsReceived.isPending}>
              {markAsReceived.isPending ? "Salvando..." : "Confirmar Recebimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
