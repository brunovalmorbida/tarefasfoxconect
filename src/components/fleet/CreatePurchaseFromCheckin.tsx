import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShoppingCart, Plus, X } from "lucide-react";

interface Props {
  toolsDescription: string;
  vehicleName: string;
}

export default function CreatePurchaseFromCheckin({ toolsDescription, vehicleName }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [urgency, setUrgency] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [buyerId, setBuyerId] = useState("");
  const [items, setItems] = useState<{ name: string; quantity: number }[]>([]);
  const [newItem, setNewItem] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: buyers = [] } = useQuery({
    queryKey: ["buyers-for-purchase"],
    queryFn: async () => {
      const { data: perms } = await supabase
        .from("user_permissions")
        .select("user_id")
        .eq("can_be_buyer", true);
      if (!perms?.length) return [];
      const ids = perms.map(p => p.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", ids);
      return profiles || [];
    },
  });

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTitle(`Ferramentas - ${vehicleName}`);
    // Parse tools description into items
    const parsed = toolsDescription
      .split(/[,;\n]+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(name => ({ name, quantity: 1 }));
    setItems(parsed.length > 0 ? parsed : [{ name: "", quantity: 1 }]);
    setOpen(true);
  };

  const addItem = () => {
    if (!newItem.trim()) return;
    setItems(prev => [...prev, { name: newItem.trim(), quantity: 1 }]);
    setNewItem("");
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!user || !buyerId || items.filter(i => i.name).length === 0) return;
    setSubmitting(true);
    try {
      const { data: list, error: listErr } = await supabase
        .from("purchase_lists")
        .insert({
          title,
          requested_by: user.id,
          buyer_id: buyerId,
          urgency,
          status: "pending",
        })
        .select("id")
        .single();
      if (listErr) throw listErr;

      const validItems = items.filter(i => i.name.trim());
      if (validItems.length > 0) {
        const { error: itemsErr } = await supabase
          .from("purchase_list_items")
          .insert(
            validItems.map(i => ({
              list_id: list.id,
              name: i.name,
              quantity: i.quantity,
              category: "maintenance",
              status: "pending" as const,
            }))
          );
        if (itemsErr) throw itemsErr;
      }

      toast.success("Lista de compras criada!");
      setOpen(false);
    } catch {
      toast.error("Erro ao criar lista de compras");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
        onClick={handleOpen}
      >
        <ShoppingCart className="h-3.5 w-3.5" />
        Criar Lista de Compras
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Criar Lista de Compras</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>Título</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Urgência</Label>
                <Select value={urgency} onValueChange={v => setUrgency(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Comprador *</Label>
                <Select value={buyerId} onValueChange={setBuyerId}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {buyers.map(b => (
                      <SelectItem key={b.user_id} value={b.user_id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Itens</Label>
              <div className="space-y-2 mt-1">
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <Input
                      className="flex-1"
                      value={item.name}
                      onChange={e => {
                        const updated = [...items];
                        updated[idx].name = e.target.value;
                        setItems(updated);
                      }}
                      placeholder="Nome do item"
                    />
                    <Input
                      className="w-16"
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={e => {
                        const updated = [...items];
                        updated[idx].quantity = parseInt(e.target.value) || 1;
                        setItems(updated);
                      }}
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeItem(idx)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  className="flex-1"
                  value={newItem}
                  onChange={e => setNewItem(e.target.value)}
                  placeholder="Adicionar item..."
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addItem())}
                />
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <Button onClick={handleSubmit} disabled={!buyerId || items.filter(i => i.name).length === 0 || submitting} className="w-full">
              <ShoppingCart className="h-4 w-4 mr-1.5" />
              Criar Lista
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
