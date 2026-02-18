import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Sem autorização");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Usuário não autenticado");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: role } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!role) throw new Error("Sem permissão de administrador");

    // Export all tables
    const tables = [
      "teams",
      "team_members",
      "profiles",
      "user_roles",
      "user_permissions",
      "boards",
      "board_columns",
      "tasks",
      "comments",
      "notifications",
      "activity_log",
      "recurring_task_boards",
      "recurring_tasks",
      "recurring_task_completions",
      "zapi_config",
    ];

    const backup: Record<string, any[]> = {};

    for (const table of tables) {
      const { data, error } = await adminClient.from(table).select("*");
      if (error) {
        console.error(`Error exporting ${table}:`, error.message);
        backup[table] = [];
      } else {
        backup[table] = data || [];
      }
    }

    // Export users list (emails + metadata)
    const { data: usersData } = await adminClient.auth.admin.listUsers();
    backup["_auth_users"] = (usersData?.users || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      phone: u.phone,
      created_at: u.created_at,
      user_metadata: u.user_metadata,
      app_metadata: u.app_metadata,
    }));

    const exportData = {
      exported_at: new Date().toISOString(),
      exported_by: caller.email,
      version: "1.0",
      tables: backup,
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="backup-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (err: any) {
    console.error("Error in export-backup:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
