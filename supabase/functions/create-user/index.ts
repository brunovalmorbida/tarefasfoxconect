import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalizePhoneBR } from "../_shared/notifications.ts";

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

    const { name, email, password, whatsappNumber, jobTitle, teamIds } = await req.json();

    // Validate inputs
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      throw new Error("Nome é obrigatório");
    }
    if (!email || typeof email !== "string" || !email.includes("@")) {
      throw new Error("E-mail inválido");
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      throw new Error("Senha deve ter pelo menos 6 caracteres");
    }

    // Create user via admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { name: name.trim() },
    });
    if (createError) throw createError;

    const userId = newUser.user.id;

    // Update profile fields if provided
    const profileUpdates: Record<string, any> = {};
    if (whatsappNumber && typeof whatsappNumber === "string" && whatsappNumber.trim()) {
      profileUpdates.whatsapp_number = normalizePhoneBR(whatsappNumber) ?? whatsappNumber.trim();
    }
    if (jobTitle && typeof jobTitle === "string" && jobTitle.trim()) {
      profileUpdates.job_title = jobTitle.trim();
    }
    if (Object.keys(profileUpdates).length > 0) {
      await adminClient
        .from("profiles")
        .update(profileUpdates)
        .eq("user_id", userId);
    }

    // Add user to selected teams
    if (teamIds && Array.isArray(teamIds) && teamIds.length > 0) {
      const teamMembers = teamIds.map((teamId: string) => ({
        team_id: teamId,
        user_id: userId,
        role: "member",
      }));
      const { error: tmError } = await adminClient
        .from("team_members")
        .insert(teamMembers);
      if (tmError) {
        console.error("Error adding team members:", tmError);
      }
    }

    return new Response(JSON.stringify({ success: true, userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
