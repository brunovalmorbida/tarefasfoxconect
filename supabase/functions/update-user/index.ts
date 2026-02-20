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

    const { userId, name, jobTitle, whatsappNumber, password, teamIds, isAdmin, email } = await req.json();
    if (!userId) throw new Error("userId é obrigatório");

    // Update email if provided
    if (email && email.trim()) {
      const { error: emailError } = await adminClient.auth.admin.updateUserById(userId, { email: email.trim() });
      if (emailError) throw emailError;
    }

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
      const { error: delError } = await adminClient
        .from("team_members")
        .delete()
        .eq("user_id", userId);
      if (delError) throw delError;

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

    // Update admin role if provided (only master admin can do this)
    if (isAdmin !== undefined) {
      // Verify caller is the master admin
      const { data: callerProfile } = await adminClient
        .from("profiles")
        .select("user_id")
        .eq("user_id", caller.id)
        .single();
      
      const { data: callerAuth } = await adminClient.auth.admin.getUserById(caller.id);
      const callerEmail = callerAuth?.user?.email;
      
      if (callerEmail !== "brunovalmorbida@live.com") {
        throw new Error("Apenas o administrador master pode alterar papéis");
      }

      if (isAdmin) {
        // Add admin role if not exists
        const { data: existingRole } = await adminClient
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        
        if (!existingRole) {
          const { error: roleError } = await adminClient
            .from("user_roles")
            .insert({ user_id: userId, role: "admin" });
          if (roleError) throw roleError;
        }
      } else {
        // Remove admin role (don't allow removing own admin)
        if (userId === caller.id) {
          throw new Error("Você não pode remover seu próprio papel de admin");
        }
        const { error: roleError } = await adminClient
          .from("user_roles")
          .delete()
          .eq("user_id", userId)
          .eq("role", "admin");
        if (roleError) throw roleError;
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
