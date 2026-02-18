import { useState } from "react";
import { useBoards } from "@/hooks/useBoards";
import { useIsAppAdmin } from "@/hooks/useUserRole";
import { CreateBoardDialog } from "@/components/kanban/CreateBoardDialog";
import { EditBoardDialog } from "@/components/kanban/EditBoardDialog";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Pencil, User } from "lucide-react";

export default function Boards() {
  const { boards, isLoading } = useBoards();
  const { data: isAdmin } = useIsAppAdmin();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [editBoard, setEditBoard] = useState<{ id: string; name: string; description: string | null; team_id: string } | null>(null);

  if (selectedBoardId) {
    return <KanbanBoard boardId={selectedBoardId} onBack={() => setSelectedBoardId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Quadros</h1>
        <CreateBoardDialog />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <LayoutGrid className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-muted-foreground">Nenhum quadro encontrado.</p>
          <p className="text-sm text-muted-foreground">Crie uma equipe e depois um quadro para começar.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {boards.map((board: any) => {
            const taskCount = board.board_columns?.reduce((sum: number, col: any) => sum + (col.tasks?.length ?? 0), 0) ?? 0;
            const colCount = board.board_columns?.length ?? 0;
            return (
              <Card
                key={board.id}
                className="hover:shadow-md transition-shadow hover:border-primary/30"
              >
                <CardHeader
                  className="pb-3 cursor-pointer"
                  onClick={() => setSelectedBoardId(board.id)}
                >
                  <CardTitle className="text-lg">{board.name}</CardTitle>
                  {board.description && <CardDescription>{board.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary">{colCount} colunas</Badge>
                      <Badge variant="secondary">{taskCount} tarefas</Badge>
                      {board.assigned_user_id && (
                        <Badge variant="outline" className="gap-1">
                          <User className="h-3 w-3" />
                          Atribuído
                        </Badge>
                      )}
                    </div>
                    <div className="flex justify-end">
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditBoard({
                              id: board.id,
                              name: board.name,
                              description: board.description,
                              team_id: board.team_id,
                            });
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {editBoard && (
        <EditBoardDialog
          open={!!editBoard}
          onOpenChange={(open) => !open && setEditBoard(null)}
          board={editBoard}
        />
      )}
    </div>
  );
}
