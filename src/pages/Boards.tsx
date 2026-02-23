import { useState } from "react";
import { useBoards } from "@/hooks/useBoards";
import { useCanManage } from "@/hooks/useUserRole";
import { CreateBoardDialog } from "@/components/kanban/CreateBoardDialog";
import { EditBoardDialog } from "@/components/kanban/EditBoardDialog";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LayoutGrid, Pencil, User, Columns3, ListTodo } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function getProgressColor(pct: number) {
  if (pct >= 70) return "bg-success";
  if (pct >= 40) return "bg-warning";
  return "bg-destructive";
}

function getProgressTextColor(pct: number) {
  if (pct >= 70) return "text-success";
  if (pct >= 40) return "text-warning";
  return "text-destructive";
}

export default function Boards() {
  const { boards, isLoading } = useBoards();
  const canManageBoards = useCanManage("can_manage_boards");
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [editBoard, setEditBoard] = useState<{ id: string; name: string; description: string | null; team_id: string; assigned_user_id: string | null } | null>(null);
  const [hoveredBoard, setHoveredBoard] = useState<string | null>(null);

  // Fetch profiles for avatars
  const { data: profiles } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name");
      return data ?? [];
    },
  });

  const getProfile = (userId: string | null) => {
    if (!userId || !profiles) return null;
    return profiles.find((p) => p.user_id === userId);
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  if (selectedBoardId) {
    return <KanbanBoard boardId={selectedBoardId} onBack={() => setSelectedBoardId(null)} />;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Quadros</h1>
          <p className="text-sm text-muted-foreground mt-1">Organize tarefas por pessoa ou equipe</p>
        </div>
        <CreateBoardDialog />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton-loading h-40 rounded-xl" />
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
            <LayoutGrid className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">Nenhum quadro encontrado</p>
            <p className="text-sm text-muted-foreground mt-1">Crie uma equipe e depois um quadro para começar.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {boards.map((board: any, index: number) => {
            const taskCount = board.board_columns?.reduce((sum: number, col: any) => sum + (col.tasks?.length ?? 0), 0) ?? 0;
            const colCount = board.board_columns?.length ?? 0;
            const doneCount = board.board_columns?.reduce((sum: number, col: any) => {
              const colName = col.name?.toLowerCase() ?? "";
              if (colName.includes("concluí") || colName.includes("done") || colName.includes("concluido")) {
                return sum + (col.tasks?.length ?? 0);
              }
              return sum;
            }, 0) ?? 0;
            const progressPct = taskCount > 0 ? Math.round((doneCount / taskCount) * 100) : 0;
            const profile = getProfile(board.assigned_user_id);
            const isHovered = hoveredBoard === board.id;

            return (
              <div
                key={board.id}
                className="card-premium cursor-pointer group"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => setSelectedBoardId(board.id)}
                onMouseEnter={() => setHoveredBoard(board.id)}
                onMouseLeave={() => setHoveredBoard(null)}
              >
                <div className="p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 min-w-0">
                      {profile ? (
                        <Avatar className="h-10 w-10 border-2 border-primary/20 flex-shrink-0">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                            {getInitials(profile.name)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <LayoutGrid className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-semibold text-base truncate">{board.name}</h3>
                        {board.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{board.description}</p>
                        )}
                      </div>
                    </div>
                    {canManageBoards && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 flex-shrink-0 transition-opacity ${isHovered ? 'opacity-100' : 'opacity-0'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditBoard({
                            id: board.id,
                            name: board.name,
                            description: board.description,
                            team_id: board.team_id,
                            assigned_user_id: board.assigned_user_id,
                          });
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Progress bar */}
                  {taskCount > 0 && (
                    <div className="space-y-1.5">
                      <div className="progress-bar">
                        <div
                          className={`progress-bar-fill animate-progress-fill ${getProgressColor(progressPct)}`}
                          style={{ "--progress-width": `${progressPct}%`, width: `${progressPct}%` } as any}
                        />
                      </div>
                      <p className={`text-xs font-medium ${getProgressTextColor(progressPct)}`}>
                        {progressPct}% concluído
                      </p>
                    </div>
                  )}

                  {/* Footer stats */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Columns3 className="h-3.5 w-3.5" />
                      {colCount} colunas
                    </span>
                    <span className="flex items-center gap-1">
                      <ListTodo className="h-3.5 w-3.5" />
                      {taskCount} tarefas
                    </span>
                    {profile && (
                      <span className="flex items-center gap-1 ml-auto">
                        <User className="h-3.5 w-3.5" />
                        {profile.name.split(" ")[0]}
                      </span>
                    )}
                  </div>
                </div>
              </div>
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