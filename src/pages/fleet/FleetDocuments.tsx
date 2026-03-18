import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useFleetDocuments, useFleetVehicles, useFleetMaintenances, FleetDocument, uploadFleetFile } from "@/hooks/useFleet";
import { Plus, Search, FileText, Trash2, Download, Eye, Upload, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isBefore, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const DOC_TYPES: Record<string, string> = {
  invoice: "Nota Fiscal", warranty: "Garantia", quote: "Orçamento",
  receipt: "Comprovante", photo: "Foto", ipva: "IPVA",
  insurance: "Seguro", licensing: "Licenciamento", other: "Outro",
};

export default function FleetDocuments() {
  const { documents, isLoading, createDocument, deleteDocument } = useFleetDocuments();
  const { vehicles } = useFleetVehicles();
  const { maintenances } = useFleetMaintenances();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterWarranty, setFilterWarranty] = useState("all");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    vehicle_id: "", maintenance_id: "", document_type: "other", title: "",
    supplier: "", document_date: "", warranty_expiry: "", notes: "",
    file_url: "", file_name: "",
  });

  const resetForm = () => setForm({
    vehicle_id: "", maintenance_id: "", document_type: "other", title: "",
    supplier: "", document_date: "", warranty_expiry: "", notes: "",
    file_url: "", file_name: "",
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form.vehicle_id) { toast.error("Selecione um veículo primeiro"); return; }
    setUploading(true);
    try {
      const url = await uploadFleetFile(file, form.vehicle_id);
      setForm(f => ({ ...f, file_url: url, file_name: file.name }));
      toast.success("Arquivo enviado");
    } catch { toast.error("Erro ao enviar arquivo"); }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!form.vehicle_id || !form.title) return;
    await createDocument.mutateAsync({
      vehicle_id: form.vehicle_id,
      maintenance_id: form.maintenance_id && form.maintenance_id !== "none" ? form.maintenance_id : null,
      document_type: form.document_type as any,
      title: form.title,
      supplier: form.supplier || null,
      document_date: form.document_date || null,
      warranty_expiry: form.warranty_expiry || null,
      notes: form.notes || null,
      file_url: form.file_url || null,
      file_name: form.file_name || null,
    });
    setDialogOpen(false);
    resetForm();
  };

  const getWarrantyBadge = (doc: FleetDocument) => {
    if (doc.document_type !== "warranty" || !doc.warranty_expiry) return null;
    const now = new Date();
    const expiry = new Date(doc.warranty_expiry);
    if (isBefore(expiry, now)) return <Badge variant="destructive" className="gap-1"><ShieldAlert className="h-3 w-3" />Vencida</Badge>;
    if (isBefore(expiry, addDays(now, 30))) return <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-600"><Shield className="h-3 w-3" />Vencendo</Badge>;
    return <Badge variant="default" className="gap-1"><ShieldCheck className="h-3 w-3" />Válida</Badge>;
  };

  const filtered = documents.filter(d => {
    if (filterType !== "all" && d.document_type !== filterType) return false;
    if (filterWarranty === "valid" && (d.document_type !== "warranty" || !d.warranty_expiry || isBefore(new Date(d.warranty_expiry), new Date()))) return false;
    if (filterWarranty === "expired" && (d.document_type !== "warranty" || !d.warranty_expiry || !isBefore(new Date(d.warranty_expiry), new Date()))) return false;
    if (filterWarranty === "expiring") {
      const now = new Date();
      if (d.document_type !== "warranty" || !d.warranty_expiry) return false;
      const exp = new Date(d.warranty_expiry);
      if (isBefore(exp, now) || !isBefore(exp, addDays(now, 30))) return false;
    }
    const v = vehicles.find(v => v.id === d.vehicle_id);
    const term = search.toLowerCase();
    return !term || d.title.toLowerCase().includes(term) || (v?.name || "").toLowerCase().includes(term) || (d.supplier || "").toLowerCase().includes(term);
  });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Documentos & Garantias</h2>
          <p className="text-muted-foreground text-sm">{documents.length} documento(s)</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto flex-wrap">
          <div className="relative flex-1 sm:w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(DOC_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterWarranty} onValueChange={setFilterWarranty}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Garantias: Todas</SelectItem>
              <SelectItem value="valid">Válidas</SelectItem>
              <SelectItem value="expiring">Vencendo</SelectItem>
              <SelectItem value="expired">Vencidas</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}><Plus className="h-4 w-4 mr-1" /> Novo</Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-12"><FileText className="h-12 w-12 text-muted-foreground mb-4" /><p className="text-muted-foreground">Nenhum documento encontrado</p></CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Veículo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Título</TableHead>
                  <TableHead className="hidden md:table-cell">Fornecedor</TableHead>
                  <TableHead className="hidden md:table-cell">Data</TableHead>
                  <TableHead>Garantia</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(d => {
                  const v = vehicles.find(v => v.id === d.vehicle_id);
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{v?.name || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{DOC_TYPES[d.document_type] || d.document_type}</Badge></TableCell>
                      <TableCell>{d.title}</TableCell>
                      <TableCell className="hidden md:table-cell">{d.supplier || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">{d.document_date ? format(new Date(d.document_date), "dd/MM/yyyy") : "—"}</TableCell>
                      <TableCell>
                        {getWarrantyBadge(d) || (d.warranty_expiry ? format(new Date(d.warranty_expiry), "dd/MM/yyyy") : "—")}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {d.file_url && (
                            <>
                              <Button variant="ghost" size="icon" asChild><a href={d.file_url} target="_blank" rel="noopener"><Eye className="h-4 w-4" /></a></Button>
                              <Button variant="ghost" size="icon" asChild><a href={d.file_url} download={d.file_name}><Download className="h-4 w-4" /></a></Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Documento</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Veículo *</Label>
                <Select value={form.vehicle_id} onValueChange={v => setForm(f => ({ ...f, vehicle_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.name} ({v.plate})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.document_type} onValueChange={v => setForm(f => ({ ...f, document_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(DOC_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ex: Nota fiscal troca de óleo" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Fornecedor</Label><Input value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} /></div>
              <div>
                <Label>Manutenção vinculada</Label>
                <Select value={form.maintenance_id} onValueChange={v => setForm(f => ({ ...f, maintenance_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {maintenances.filter(m => m.vehicle_id === form.vehicle_id).map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.maintenance_type} - {format(new Date(m.maintenance_date), "dd/MM/yyyy")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data do documento</Label><Input type="date" value={form.document_date} onChange={e => setForm(f => ({ ...f, document_date: e.target.value }))} /></div>
              <div><Label>Vencimento da garantia</Label><Input type="date" value={form.warranty_expiry} onChange={e => setForm(f => ({ ...f, warranty_expiry: e.target.value }))} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
            <div>
              <Label>Arquivo</Label>
              <div className="flex items-center gap-2 mt-1">
                <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} />
                <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading || !form.vehicle_id}>
                  <Upload className="h-4 w-4 mr-1" />{uploading ? "Enviando..." : "Selecionar arquivo"}
                </Button>
                {form.file_name && <span className="text-sm text-muted-foreground truncate max-w-48">{form.file_name}</span>}
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={!form.vehicle_id || !form.title}>Adicionar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir documento?</AlertDialogTitle><AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) deleteDocument.mutate(deleteId); setDeleteId(null); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
