import { useState } from "react";
import { useLogActivity } from "@/hooks/useActivityLog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, Tag, Package } from "lucide-react";
import { toast } from "sonner";

export function PurchasesConfigTab() {
  const queryClient = useQueryClient();
  const logActivity = useLogActivity();

  // ---- Categories ----
  const [catDialog, setCatDialog] = useState(false);
  const [editingCat, setEditingCat] = useState<any>(null);
  const [catName, setCatName] = useState("");

  const { data: categories = [], isLoading: loadingCats } = useQuery({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_categories").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveCat = useMutation({
    mutationFn: async () => {
      const trimmed = catName.trim();
      if (!trimmed) throw new Error("Nome obrigatório");
      if (editingCat) {
        const { error } = await supabase.from("product_categories").update({ name: trimmed }).eq("id", editingCat.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_categories").insert({ name: trimmed });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      toast.success(editingCat ? "Categoria atualizada" : "Categoria criada");
      logActivity(editingCat ? "Atualizou categoria de produto" : "Criou categoria de produto", { name: catName.trim() });
      setCatDialog(false);
      setCatName("");
      setEditingCat(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
      queryClient.invalidateQueries({ queryKey: ["product-catalog"] });
      toast.success("Categoria removida");
      logActivity("Removeu categoria de produto", { category_id: id });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ---- Products ----
  const [prodDialog, setProdDialog] = useState(false);
  const [editingProd, setEditingProd] = useState<any>(null);
  const [prodName, setProdName] = useState("");
  const [prodCategoryId, setProdCategoryId] = useState<string>("");
  const [prodEstValue, setProdEstValue] = useState("");

  const { data: products = [], isLoading: loadingProds } = useQuery({
    queryKey: ["product-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_catalog")
        .select("*, product_categories(name)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const saveProd = useMutation({
    mutationFn: async () => {
      const trimmed = prodName.trim();
      if (!trimmed) throw new Error("Nome obrigatório");
      const payload: any = {
        name: trimmed,
        category_id: prodCategoryId || null,
        default_estimated_value: prodEstValue ? parseFloat(prodEstValue) : null,
      };
      if (editingProd) {
        const { error } = await supabase.from("product_catalog").update(payload).eq("id", editingProd.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_catalog").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-catalog"] });
      toast.success(editingProd ? "Produto atualizado" : "Produto cadastrado");
      logActivity(editingProd ? "Atualizou produto no catálogo" : "Cadastrou produto no catálogo", { name: prodName.trim() });
      closeProdDialog();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteProd = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_catalog").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["product-catalog"] });
      toast.success("Produto removido");
      logActivity("Removeu produto do catálogo", { product_id: id });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const closeProdDialog = () => {
    setProdDialog(false);
    setProdName("");
    setProdCategoryId("");
    setProdEstValue("");
    setEditingProd(null);
  };

  const openEditProd = (p: any) => {
    setEditingProd(p);
    setProdName(p.name);
    setProdCategoryId(p.category_id || "");
    setProdEstValue(p.default_estimated_value?.toString() || "");
    setProdDialog(true);
  };

  const catMap = new Map(categories.map((c: any) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      {/* Categories */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" /> Categorias de Produtos
            </CardTitle>
            <CardDescription>Cadastre as categorias para organizar os produtos.</CardDescription>
          </div>
          <Button size="sm" onClick={() => { setCatName(""); setEditingCat(null); setCatDialog(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Nova Categoria
          </Button>
        </CardHeader>
        <CardContent>
          {loadingCats ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : categories.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhuma categoria cadastrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingCat(c); setCatName(c.name); setCatDialog(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteCat.mutate(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Products */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" /> Catálogo de Produtos
            </CardTitle>
            <CardDescription>Cadastre produtos para usar nas listas de compras e relatórios.</CardDescription>
          </div>
          <Button size="sm" onClick={() => { closeProdDialog(); setProdDialog(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Novo Produto
          </Button>
        </CardHeader>
        <CardContent>
          {loadingProds ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : products.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum produto cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Valor Estimado</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.category_id ? catMap.get(p.category_id) || "—" : "—"}</TableCell>
                    <TableCell>{p.default_estimated_value ? `R$ ${Number(p.default_estimated_value).toFixed(2)}` : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditProd(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProd.mutate(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Category Dialog */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCat ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Ex: Material de Escritório" maxLength={100} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveCat.mutate()} disabled={saveCat.isPending}>
              {saveCat.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Dialog */}
      <Dialog open={prodDialog} onOpenChange={(open) => { if (!open) closeProdDialog(); else setProdDialog(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProd ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={prodName} onChange={(e) => setProdName(e.target.value)} placeholder="Ex: Papel A4" maxLength={150} />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={prodCategoryId} onValueChange={setProdCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor Estimado Padrão (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={prodEstValue}
                onChange={(e) => setProdEstValue(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeProdDialog}>Cancelar</Button>
            <Button onClick={() => saveProd.mutate()} disabled={saveProd.isPending}>
              {saveProd.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
