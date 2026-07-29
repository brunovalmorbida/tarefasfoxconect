import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CITIES } from "@/lib/techSchedule";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCity?: string;
  onSave: (values: { client_name: string; city: string }) => void;
  isSaving?: boolean;
}

export function AppointmentDialog({
  open,
  onOpenChange,
  defaultCity,
  onSave,
  isSaving,
}: Props) {
  const [clientName, setClientName] = useState("");
  const [city, setCity] = useState(CITIES[0].name);

  useEffect(() => {
    if (!open) return;
    setClientName("");
    setCity(defaultCity ?? CITIES[0].name);
  }, [open, defaultCity]);

  const submit = () => {
    if (!clientName.trim()) return;
    onSave({ client_name: clientName.trim(), city });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Novo cliente para agendar</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do cliente *</Label>
            <Input
              autoFocus
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Ex.: João da Silva"
            />
          </div>

          <div className="space-y-2">
            <Label>Cidade</Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CITIES.map((c) => (
                  <SelectItem key={c.key} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={isSaving}>Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
