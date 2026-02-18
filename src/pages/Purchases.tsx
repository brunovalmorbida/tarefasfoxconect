import { useState } from "react";
import { usePurchases, PurchaseRequest } from "@/hooks/usePurchases";
import { useAuth } from "@/hooks/useAuth";
import { useIsAppAdmin } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ShoppingCart, PackageCheck, Trash2, Clock, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const urgencyColors: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  urgent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const urgencyLabels: Record<string, string> = {
  low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente",
};

const categoryLabels: Record<string, string> = {
  office: "Escritório", cleaning: "Limpeza", technology: "Tecnologia",
  maintenance: "Manutenção", food: "Alimentação", other: "Outros",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente", purchased: "Comprado", received: "Recebido",
};

const statusColors: Record<string, string> = {
  pending: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  purchased: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  received: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export default function Purchases() {
  const { user } = useAuth();
  const { data: isAdmin } = useIsAppAdmin();
  const { purchases, isLoading, createPurchase, markAsPurchased, markAsReceived, deletePurchase } = usePurchases();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState<PurchaseRequest | null>(null);
  const [showReceiveDialog, setShowReceiveDialog] = useState<PurchaseRequest | null>(null);

  type ListItem = {
    title: string;
    quantity: string;
    category: string;
    urgency: string;
    estimated_value: string;
    description: string;
  };

  const emptyItem = (): ListItem => ({
    title: "", quantity: "1", category: "other", urgency: "medium", estimated_value: "", description: "",
  });

  // Form state - list of items
  const [listItems, setListItems] = useState<ListItem[]>([emptyItem()]);
  const [newBuyerId, setNewBuyerId] = useState("");

  // Purchase dialog state
  const [purchaseActualValue, setPurchaseActualValue] = useState("");
  const [purchaseNotes, setPurchaseNotes] = useState("");

  // Receive dialog state
  const [receiveNotes, setReceiveNotes] = useState("");

  // Fetch all profiles for buyer selection
  const { data: allProfiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name");
      return data || [];
    },
    enabled: !!user,
  });

  const updateListItem = (index: number, field: keyof ListItem, value: string) => {
    setListItems((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const addListItem = () => setListItems((prev) => [...prev, emptyItem()]);

  const removeListItem = (index: number) => {
    if (listItems.length <= 1) return;
    setListItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = () => {
    const validItems = listItems.filter((item) => item.title.trim());
    if (validItems.length === 0) return;
    createPurchase.mutate(
      validItems.map((item) => ({
        title: item.title.trim(),
        description: item.description.trim() || undefined,
        quantity: parseInt(item.quantity) || 1,
        category: item.category,
        urgency: item.urgency,
        estimated_value: item.estimated_value ? parseFloat(item.estimated_value) : undefined,
        buyer_id: newBuyerId || undefined,
      })),
      {
        onSuccess: () => {
          setShowCreateDialog(false);
          setListItems([emptyItem()]);
          setNewBuyerId("");
        },
      }
    );
  };

  const handleMarkPurchased = () => {
    if (!showPurchaseDialog) return;
    markAsPurchased.mutate({
      id: showPurchaseDialog.id,
      actual_value: purchaseActualValue ? parseFloat(purchaseActualValue) : undefined,
      purchase_notes: purchaseNotes.trim() || undefined,
    }, {
      onSuccess: () => {
        setShowPurchaseDialog(null);
        setPurchaseActualValue(""); setPurchaseNotes("");
      },
    });
  };

  const handleMarkReceived = () => {
    if (!showReceiveDialog) return;
    markAsReceived.mutate({
      id: showReceiveDialog.id,
      receive_notes: receiveNotes.trim() || undefined,
    }, {
      onSuccess: () => {
        setShowReceiveDialog(null);
        setReceiveNotes("");
      },
    });
  };

  const pending = purchases.filter((p) => p.status === "pending");
  const purchased = purchases.filter((p) => p.status === "purchased");
  const received = purchases.filter((p) => p.status === "received");

  const renderCard = (purchase: PurchaseRequest) => (
    <Card key={purchase.id} className="relative">
      <CardContent className="pt-4 pb-3 px-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm leading-tight">{purchase.title}</h3>
          <div className="flex gap-1 shrink-0">
            <Badge className={`text-[10px] px-1.5 py-0 ${urgencyColors[purchase.urgency]}`}>
              {urgencyLabels[purchase.urgency]}
            </Badge>
            <Badge className={`text-[10px] px-1.5 py-0 ${statusColors[purchase.status]}`}>
              {statusLabels[purchase.status]}
            </Badge>
          </div>
        </div>

        {purchase.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{purchase.description}</p>
        )}

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>📊 Qtd: {purchase.quantity}</span>
          <span>📂 {categoryLabels[purchase.category]}</span>
          {purchase.estimated_value && <span>💰 Est: R$ {Number(purchase.estimated_value).toFixed(2)}</span>}
          {purchase.actual_value && <span>💰 Real: R$ {Number(purchase.actual_value).toFixed(2)}</span>}
        </div>

        <div className="text-xs text-muted-foreground">
          <span>👤 {purchase.requester_name}</span>
          {purchase.buyer_name && <span className="ml-3">🛍️ {purchase.buyer_name}</span>}
        </div>

        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {format(new Date(purchase.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </div>

        <div className="flex gap-1 pt-1">
          {purchase.status === "pending" && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={() => {
                setPurchaseActualValue(purchase.estimated_value?.toString() || "");
                setShowPurchaseDialog(purchase);
              }}
            >
              <ShoppingCart className="h-3 w-3 mr-1" />
              Comprado
            </Button>
          )}
          {purchase.status === "purchased" && purchase.requested_by === user?.id && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs h-7"
              onClick={() => setShowReceiveDialog(purchase)}
            >
              <PackageCheck className="h-3 w-3 mr-1" />
              Recebido
            </Button>
          )}
          {isAdmin && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7 text-destructive hover:text-destructive"
              onClick={() => deletePurchase.mutate(purchase.id)}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Compras</h1>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Solicitação
        </Button>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pendentes ({pending.length})</TabsTrigger>
          <TabsTrigger value="purchased">Comprados ({purchased.length})</TabsTrigger>
          <TabsTrigger value="received">Recebidos ({received.length})</TabsTrigger>
          <TabsTrigger value="all">Todos ({purchases.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pending.length === 0 ? <p className="text-muted-foreground col-span-full">Nenhuma solicitação pendente.</p> : pending.map(renderCard)}
          </div>
        </TabsContent>
        <TabsContent value="purchased" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {purchased.length === 0 ? <p className="text-muted-foreground col-span-full">Nenhuma compra realizada.</p> : purchased.map(renderCard)}
          </div>
        </TabsContent>
        <TabsContent value="received" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {received.length === 0 ? <p className="text-muted-foreground col-span-full">Nenhum material recebido.</p> : received.map(renderCard)}
          </div>
        </TabsContent>
        <TabsContent value="all" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {purchases.length === 0 ? <p className="text-muted-foreground col-span-full">Nenhuma solicitação.</p> : purchases.map(renderCard)}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Solicitação de Compra</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Shared buyer for all items */}
            <div>
              <Label>Responsável pela compra (todos os itens)</Label>
              <Select value={newBuyerId} onValueChange={setNewBuyerId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {allProfiles?.map((p) => (
                    <SelectItem key={p.user_id} value={p.user_id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Items list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Itens ({listItems.length})</Label>
                <Button type="button" variant="outline" size="sm" onClick={addListItem}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar Item
                </Button>
              </div>

              {listItems.map((item, index) => (
                <Card key={index} className="relative">
                  <CardContent className="pt-3 pb-3 px-3 space-y-2">
                    {listItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeListItem(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                    <div className="pr-6">
                      <Label className="text-xs">Item {index + 1} *</Label>
                      <Input
                        value={item.title}
                        onChange={(e) => updateListItem(index, "title", e.target.value)}
                        placeholder="Nome do item"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      <div>
                        <Label className="text-xs">Qtd</Label>
                        <Input type="number" min="1" value={item.quantity} onChange={(e) => updateListItem(index, "quantity", e.target.value)} className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs">Valor Est. (R$)</Label>
                        <Input type="number" step="0.01" value={item.estimated_value} onChange={(e) => updateListItem(index, "estimated_value", e.target.value)} placeholder="0.00" className="h-8 text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs">Categoria</Label>
                        <Select value={item.category} onValueChange={(v) => updateListItem(index, "category", v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(categoryLabels).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Urgência</Label>
                        <Select value={item.urgency} onValueChange={(v) => updateListItem(index, "urgency", v)}>
                          <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(urgencyLabels).map(([k, v]) => (
                              <SelectItem key={k} value={k}>{v}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Observações</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => updateListItem(index, "description", e.target.value)}
                        placeholder="Detalhes..."
                        className="h-8 text-sm"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!listItems.some((i) => i.title.trim()) || createPurchase.isPending}>
              {createPurchase.isPending ? "Criando..." : `Criar ${listItems.filter((i) => i.title.trim()).length} Item(ns)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Purchase Dialog */}
      <Dialog open={!!showPurchaseDialog} onOpenChange={() => setShowPurchaseDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Compra</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Confirmar compra de: <strong>{showPurchaseDialog?.title}</strong>
            </p>
            <div>
              <Label>Valor Real (R$)</Label>
              <Input type="number" step="0.01" value={purchaseActualValue} onChange={(e) => setPurchaseActualValue(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <Label>Observações da Compra</Label>
              <Textarea value={purchaseNotes} onChange={(e) => setPurchaseNotes(e.target.value)} placeholder="Onde comprou, nota fiscal..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPurchaseDialog(null)}>Cancelar</Button>
            <Button onClick={handleMarkPurchased} disabled={markAsPurchased.isPending}>
              {markAsPurchased.isPending ? "Salvando..." : "Confirmar Compra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      <Dialog open={!!showReceiveDialog} onOpenChange={() => setShowReceiveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Recebimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Confirmar recebimento de: <strong>{showReceiveDialog?.title}</strong>
            </p>
            <div>
              <Label>Observações do Recebimento</Label>
              <Textarea value={receiveNotes} onChange={(e) => setReceiveNotes(e.target.value)} placeholder="Condição, quantidade conferida..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceiveDialog(null)}>Cancelar</Button>
            <Button onClick={handleMarkReceived} disabled={markAsReceived.isPending}>
              {markAsReceived.isPending ? "Salvando..." : "Confirmar Recebimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
