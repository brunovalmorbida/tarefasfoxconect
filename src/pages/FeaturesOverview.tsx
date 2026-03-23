import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard, Columns3, ListChecks, ShoppingCart, Car, Instagram,
  Bell, Settings, MessageSquare, Search, Users, Shield, BarChart3,
  Wrench, FileText, DollarSign, Bot, ArrowRight, Zap, Globe,
  CheckCircle2, Gauge, Upload, Calendar, UserCircle
} from "lucide-react";

const modules = [
  {
    title: "Dashboard",
    description: "Painel principal com visão geral de produtividade, tarefas atrasadas, atividades recentes e métricas por módulo.",
    icon: LayoutDashboard,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    route: "/",
    features: [
      "Score de produtividade pessoal",
      "Alertas de tarefas atrasadas com lista expansível",
      "Atividades recentes do time",
      "Métricas de quadros, tarefas fixas e compras",
      "Dashboard diferenciado para Admin e Membro",
    ],
  },
  {
    title: "Quadros Kanban",
    description: "Gestão visual de tarefas com drag-and-drop, subtarefas, comentários e prioridades.",
    icon: Columns3,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    route: "/boards",
    features: [
      "Criação de quadros por equipe",
      "Colunas personalizáveis com drag-and-drop",
      "Tarefas com prioridade, prazo e responsável",
      "Subtarefas (checklist)",
      "Comentários em tarefas",
      "Duplicação de tarefas",
      "Labels/Etiquetas coloridas",
      "Atualização em tempo real",
    ],
  },
  {
    title: "Tarefas Fixas / Recorrentes",
    description: "Gerenciamento de tarefas que se repetem com frequência configurável e controle de conclusão.",
    icon: ListChecks,
    color: "text-green-500",
    bg: "bg-green-500/10",
    route: "/recurring-tasks",
    features: [
      "Frequências: diária, semanal, mensal",
      "Quadros de tarefas recorrentes por equipe",
      "Controle de conclusão por período",
      "Agendamento por dia da semana ou dia do mês",
      "Horário programado opcional",
    ],
  },
  {
    title: "Compras",
    description: "Sistema completo de listas de compras com fluxo de aprovação, compradores e recebimento.",
    icon: ShoppingCart,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    route: "/purchases",
    features: [
      "Listas de compras com itens categorizados",
      "Fluxo: Pendente → Comprado → Recebido",
      "Urgência configurável (baixa a urgente)",
      "Atribuição de comprador",
      "Valor estimado e valor real",
      "Catálogo de produtos reutilizável",
      "Notificações por etapa",
    ],
  },
  {
    title: "Frota",
    description: "Módulo completo de gestão de frota com veículos, motoristas, manutenções, check-ins, custos e score.",
    icon: Car,
    color: "text-cyan-500",
    bg: "bg-cyan-500/10",
    route: "/fleet",
    features: [
      "Cadastro de veículos com placa, marca, modelo e km",
      "Gestão de motoristas vinculados",
      "Check-ins periódicos com status e ferramentas",
      "Manutenções preventivas e corretivas",
      "Prioridade automática (Crítico/Atenção/Baixo)",
      "Score de saúde do veículo (0-100)",
      "Controle financeiro de custos",
      "Upload de comprovantes e documentos",
      "Dashboard com rankings e insights",
    ],
  },
  {
    title: "Social Media",
    description: "Gestão de produção de conteúdo para redes sociais com pipeline, metas semanais e provas de postagem.",
    icon: Instagram,
    color: "text-pink-500",
    bg: "bg-pink-500/10",
    route: "/social-media",
    features: [
      "Pipeline visual: Ideia → Produção → Aprovação → Publicado",
      "Categorias de conteúdo personalizáveis",
      "Metas semanais por categoria",
      "Upload de provas de postagem",
      "Integração com Google Drive",
      "Link do post publicado",
    ],
  },
  {
    title: "Notificações",
    description: "Sistema de notificações internas e via WhatsApp com configurações granulares.",
    icon: Bell,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    route: "/notifications",
    features: [
      "Notificações in-app em tempo real",
      "Notificações via WhatsApp (Z-API)",
      "Alertas de tarefas atrasadas",
      "Lembrete de tarefas agendadas",
      "Notificações de compras por etapa",
      "Resumo diário automático",
    ],
  },
  {
    title: "Bot WhatsApp (IA)",
    description: "Assistente inteligente via WhatsApp para criar tarefas, listar pendências e gerenciar o sistema por mensagem.",
    icon: Bot,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    route: "/settings",
    features: [
      "Linguagem natural com IA",
      "Criar tarefas por mensagem",
      "Listar tarefas pendentes e atrasadas",
      "Concluir tarefas e tarefas fixas",
      "Adicionar itens à lista de compras",
      "Resumo do dia",
    ],
  },
  {
    title: "Equipes & Permissões",
    description: "Gerenciamento de equipes, membros, visibilidade e permissões granulares por módulo.",
    icon: Shield,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    route: "/settings",
    features: [
      "Criação de equipes com membros",
      "Roles: Admin e Membro",
      "Visibilidade de equipes por usuário",
      "Permissões granulares por módulo",
      "Gestão de compradores",
      "Permissão de motorista",
    ],
  },
  {
    title: "Configurações",
    description: "Central de configurações do sistema, integrações, log de atividades e exportação.",
    icon: Settings,
    color: "text-muted-foreground",
    bg: "bg-muted",
    route: "/settings",
    features: [
      "Integração Z-API (WhatsApp)",
      "Integração Google Drive",
      "Log de atividades completo",
      "Configuração de notificações",
      "Configuração de compras e frota",
      "Exportação de backup do sistema",
      "Tema claro / escuro",
    ],
  },
  {
    title: "Busca Global",
    description: "Pesquisa rápida em todo o sistema com atalho de teclado Ctrl+K.",
    icon: Search,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    route: "/",
    features: [
      "Atalho Ctrl+K / Cmd+K",
      "Busca em tarefas, quadros e compras",
      "Navegação rápida para qualquer item",
    ],
  },
  {
    title: "Perfil do Usuário",
    description: "Página de perfil pessoal com avatar, dados e número de WhatsApp.",
    icon: UserCircle,
    color: "text-teal-500",
    bg: "bg-teal-500/10",
    route: "/profile",
    features: [
      "Nome, cargo e avatar",
      "Número de WhatsApp para bot e notificações",
      "Alteração de senha",
    ],
  },
];

export default function FeaturesOverview() {
  const navigate = useNavigate();
  const totalFeatures = modules.reduce((sum, m) => sum + m.features.length, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Visão Geral do TaskFox</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Resumo completo de todos os módulos e funcionalidades da plataforma
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{modules.length}</p>
            <p className="text-xs text-muted-foreground">Módulos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalFeatures}</p>
            <p className="text-xs text-muted-foreground">Funcionalidades</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">v3.1</p>
            <p className="text-xs text-muted-foreground">Versão Atual</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-1">
              <Zap className="h-5 w-5 text-primary" />
              <p className="text-2xl font-bold text-primary">IA</p>
            </div>
            <p className="text-xs text-muted-foreground">Bot Integrado</p>
          </CardContent>
        </Card>
      </div>

      {/* Modules Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => (
          <Card key={mod.title} className="group hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${mod.bg}`}>
                    <mod.icon className={`h-5 w-5 ${mod.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-base">{mod.title}</CardTitle>
                    <Badge variant="secondary" className="text-[10px] mt-1">
                      {mod.features.length} funções
                    </Badge>
                  </div>
                </div>
              </div>
              <CardDescription className="text-xs mt-2">{mod.description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <ul className="space-y-1.5">
                {mod.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary/60" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs group-hover:bg-primary/5"
                onClick={() => navigate(mod.route)}
              >
                Acessar módulo
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
