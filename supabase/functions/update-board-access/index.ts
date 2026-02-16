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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Não autenticado");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: role } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!role) throw new Error("Sem permissão de administrador");

    const { teamId, userIds } = await req.json();
    if (!teamId) throw new Error("teamId é obrigatório");
    if (!Array.isArray(userIds)) throw new Error("userIds deve ser um array");

    // Get current members
    const { data: currentMembers } = await adminClient
      .from("team_members")
      .select("user_id, role")
      .eq("team_id", teamId);

    // Keep admins (team role admin) - don't remove them
    const adminUserIds = (currentMembers || [])
      .filter((m) => m.role === "admin")
      .map((m) => m.user_id);

    // Ensure all admin users are included
    const finalUserIds = [...new Set([...userIds, ...adminUserIds])];

    // Delete all non-admin members
    const nonAdminIds = (currentMembers || [])
      .filter((m) => m.role !== "admin")
      .map((m) => m.user_id);

    if (nonAdminIds.length > 0) {
      const { error: delError } = await adminClient
        .from("team_members")
        .delete()
        .eq("team_id", teamId)
        .in("user_id", nonAdminIds);
      if (delError) throw delError;
    }

    // Add new members (excluding existing admins)
    const newMembers = finalUserIds
      .filter((uid: string) => !adminUserIds.includes(uid))
      .map((uid: string) => ({
        team_id: teamId,
        user_id: uid,
        role: "member",
      }));

    if (newMembers.length > 0) {
      const { error: insError } = await adminClient
        .from("team_members")
        .insert(newMembers);
      if (insError) throw insError;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
