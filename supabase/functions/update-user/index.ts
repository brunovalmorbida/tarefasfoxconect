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

    const { userId, name, jobTitle, whatsappNumber, password, teamIds } = await req.json();
    if (!userId) throw new Error("userId é obrigatório");

    // Update profile
    const profileUpdates: Record<string, any> = {};
    if (name !== undefined) profileUpdates.name = name.trim();
    if (jobTitle !== undefined) profileUpdates.job_title = jobTitle.trim() || null;
    if (whatsappNumber !== undefined) profileUpdates.whatsapp_number = whatsappNumber || null;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update(profileUpdates)
        .eq("user_id", userId);
      if (profileError) throw profileError;
    }

    // Update password if provided
    if (password && password.length >= 6) {
      const { error: pwError } = await adminClient.auth.admin.updateUserById(userId, { password });
      if (pwError) throw pwError;
    }

    // Update team memberships
    if (teamIds !== undefined && Array.isArray(teamIds)) {
      // Remove all current memberships (except admin ones handled by trigger)
      const { error: delError } = await adminClient
        .from("team_members")
        .delete()
        .eq("user_id", userId);
      if (delError) throw delError;

      // Add new memberships
      if (teamIds.length > 0) {
        const rows = teamIds.map((tid: string) => ({
          team_id: tid,
          user_id: userId,
          role: "member",
        }));
        const { error: insError } = await adminClient
          .from("team_members")
          .insert(rows);
        if (insError) throw insError;
      }
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
