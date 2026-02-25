import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Trash2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TaskCommentsProps {
  taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newComment, setNewComment] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["task-comments", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Fetch profiles for comment authors
      const userIds = [...new Set(data.map((c) => c.user_id))];
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.user_id, p.name]) ?? []);

      return data.map((c) => ({
        ...c,
        author_name: profileMap.get(c.user_id) ?? "Usuário",
      }));
    },
    enabled: !!taskId,
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from("comments").insert({
        task_id: taskId,
        user_id: user!.id,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
      setNewComment("");
    },
    onError: () => toast.error("Erro ao adicionar comentário"),
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-comments", taskId] });
      toast.success("Comentário excluído");
    },
    onError: () => toast.error("Erro ao excluir comentário"),
  });

  const handleSubmit = () => {
    if (!newComment.trim()) return;
    addComment.mutate(newComment.trim());
  };

  const getInitials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        <label className="text-sm font-medium">Comentários ({comments.length})</label>
      </div>

      {comments.length > 0 && (
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-3 pr-3">
            {comments.map((comment: any) => (
              <div key={comment.id} className="flex gap-2 group">
                <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
                  <AvatarFallback className="text-[9px] bg-primary/10 text-primary font-semibold">
                    {getInitials(comment.author_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{comment.author_name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                    {comment.user_id === user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteComment.mutate(comment.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-foreground/80 whitespace-pre-wrap break-words">{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <div className="flex gap-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Escreva um comentário..."
          rows={2}
          className="text-sm resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        <Button
          size="icon"
          className="flex-shrink-0 self-end"
          onClick={handleSubmit}
          disabled={!newComment.trim() || addComment.isPending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
