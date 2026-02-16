import { useState } from "react";
import { useBoards } from "@/hooks/useBoards";
import { CreateBoardDialog } from "@/components/kanban/CreateBoardDialog";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid } from "lucide-react";

export default function Boards() {
  const { boards, isLoading } = useBoards();
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);

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
                className="cursor-pointer hover:shadow-md transition-shadow hover:border-primary/30"
                onClick={() => setSelectedBoardId(board.id)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{board.name}</CardTitle>
                  {board.description && <CardDescription>{board.description}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Badge variant="secondary">{colCount} colunas</Badge>
                    <Badge variant="secondary">{taskCount} tarefas</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
