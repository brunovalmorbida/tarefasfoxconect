import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Search, Columns3, CheckSquare, ShoppingCart, Loader2 } from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: "task" | "board" | "purchase";
  meta?: Record<string, string>;
  navigateTo?: string;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(
    async (term: string) => {
      if (!term.trim() || !user) {
        setResults([]);
        return;
      }
      setLoading(true);

      const [tasksRes, boardsRes, purchasesRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, description, priority")
          .or(`title.ilike.%${term}%,description.ilike.%${term}%`)
          .limit(8),
        supabase
          .from("boards")
          .select("id, name, description")
          .or(`name.ilike.%${term}%,description.ilike.%${term}%`)
          .limit(5),
        supabase
          .from("purchase_lists")
          .select("id, title, status, urgency")
          .ilike("title", `%${term}%`)
          .limit(5),
      ]);

      const items: SearchResult[] = [];

      if (tasksRes.data) {
        for (const t of tasksRes.data) {
          items.push({
            id: t.id,
            title: t.title,
            subtitle: t.description?.slice(0, 60) || undefined,
            type: "task",
            meta: { priority: t.priority },
          });
        }
      }

      if (boardsRes.data) {
        for (const b of boardsRes.data) {
          items.push({
            id: b.id,
            title: b.name,
            subtitle: b.description?.slice(0, 60) || undefined,
            type: "board",
            navigateTo: "/boards",
          });
        }
      }

      if (purchasesRes.data) {
        for (const p of purchasesRes.data) {
          items.push({
            id: p.id,
            title: p.title,
            type: "purchase",
            meta: { status: p.status, urgency: p.urgency },
            navigateTo: "/purchases",
          });
        }
      }

      setResults(items);
      setLoading(false);
    },
    [user],
  );

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = (item: SearchResult) => {
    setOpen(false);
    setQuery("");
    if (item.navigateTo) {
      navigate(item.navigateTo);
    } else if (item.type === "task") {
      navigate("/boards");
    }
  };

  const priorityColor: Record<string, string> = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-primary/20 text-primary",
    high: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
    urgent: "bg-destructive/20 text-destructive",
  };

  const statusLabel: Record<string, string> = {
    pending: "Pendente",
    purchased: "Comprado",
    received: "Recebido",
  };

  const typeIcon = {
    task: CheckSquare,
    board: Columns3,
    purchase: ShoppingCart,
  };

  const tasks = results.filter((r) => r.type === "task");
  const boards = results.filter((r) => r.type === "board");
  const purchases = results.filter((r) => r.type === "purchase");

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="relative h-9 w-9 p-0 xl:h-9 xl:w-60 xl:justify-start xl:px-3 xl:py-2"
        onClick={() => setOpen(true)}
      >
        <Search className="h-4 w-4 xl:mr-2" />
        <span className="hidden xl:inline-flex text-muted-foreground">Buscar...</span>
        <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 xl:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          placeholder="Buscar tarefas, quadros, compras..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && query.trim() && results.length === 0 && (
            <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
          )}

          {tasks.length > 0 && (
            <CommandGroup heading="Tarefas">
              {tasks.map((item) => {
                const Icon = typeIcon[item.type];
                return (
                  <CommandItem key={item.id} onSelect={() => handleSelect(item)} className="gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm">{item.title}</p>
                      {item.subtitle && (
                        <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                      )}
                    </div>
                    {item.meta?.priority && (
                      <Badge variant="secondary" className={`text-[10px] ${priorityColor[item.meta.priority]}`}>
                        {item.meta.priority}
                      </Badge>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {boards.length > 0 && (
            <>
              {tasks.length > 0 && <CommandSeparator />}
              <CommandGroup heading="Quadros">
                {boards.map((item) => {
                  const Icon = typeIcon[item.type];
                  return (
                    <CommandItem key={item.id} onSelect={() => handleSelect(item)} className="gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm">{item.title}</p>
                        {item.subtitle && (
                          <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}

          {purchases.length > 0 && (
            <>
              {(tasks.length > 0 || boards.length > 0) && <CommandSeparator />}
              <CommandGroup heading="Compras">
                {purchases.map((item) => {
                  const Icon = typeIcon[item.type];
                  return (
                    <CommandItem key={item.id} onSelect={() => handleSelect(item)} className="gap-2">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm">{item.title}</p>
                      </div>
                      {item.meta?.status && (
                        <Badge variant="outline" className="text-[10px]">
                          {statusLabel[item.meta.status] || item.meta.status}
                        </Badge>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
