import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Profile {
  id: string;
  user_id: string;
  name: string;
  job_title: string | null;
  created_at: string;
}

export function UsersTab() {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Profile[];
    },
  });

  const { data: adminRoles } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (error) throw error;
      return data;
    },
  });

  const getRoleForUser = (userId: string) => {
    const role = adminRoles?.find((r) => r.user_id === userId);
    return role?.role === "admin" ? "Admin" : "Membro";
  };

  const handleDelete = async (userId: string) => {
    setDeletingId(userId);
    try {
      const { error } = await supabase.functions.invoke("delete-user", {
        body: { userId },
      });
      if (error) throw error;
      toast.success("Usuário removido com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover usuário");
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usuários</CardTitle>
        <CardDescription>Gerencie os usuários do sistema.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead className="w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {profiles?.map((profile) => (
              <TableRow key={profile.id}>
                <TableCell className="font-medium">{profile.name}</TableCell>
                <TableCell>{profile.job_title || "—"}</TableCell>
                <TableCell>
                  <Badge variant={getRoleForUser(profile.user_id) === "Admin" ? "default" : "secondary"}>
                    {getRoleForUser(profile.user_id)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {new Date(profile.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
                <TableCell>
                  {getRoleForUser(profile.user_id) !== "Admin" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover usuário</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover {profile.name}? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(profile.user_id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            {deletingId === profile.user_id ? "Removendo..." : "Remover"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
