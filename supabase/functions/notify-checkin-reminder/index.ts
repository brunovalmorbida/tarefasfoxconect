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
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Business hours check (BRT) — 08:00-18:00 Mon-Fri, 08:00-12:00 Sat
    const _now = new Date();
    const brtNow = new Date(_now.getTime() + (-3 * 60 + _now.getTimezoneOffset()) * 60000);
    const dayOfWeek = brtNow.getDay();
    const totalMin = brtNow.getHours() * 60 + brtNow.getMinutes();

    const isBusinessHours = (() => {
      if (dayOfWeek === 0) return false;
      if (dayOfWeek === 6) return totalMin >= 480 && totalMin < 720;
      return totalMin >= 480 && totalMin < 1080;
    })();

    if (!isBusinessHours) {
      return new Response(JSON.stringify({ message: "Fora do horário comercial", skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if auto check-in is enabled
    const { data: settings } = await adminClient
      .from("fleet_settings")
      .select("auto_checkin_enabled")
      .limit(1)
      .maybeSingle();

    if (!settings?.auto_checkin_enabled) {
      return new Response(JSON.stringify({ message: "Check-in automático desativado", skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check Z-API
    const { data: zapiConfig } = await adminClient
      .from("zapi_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!zapiConfig) {
      return new Response(JSON.stringify({ message: "Z-API não configurada", skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find today's INCOMPLETE check-ins (status = "pending")
    const todayStr = new Date().toISOString().slice(0, 10);
    const { data: incompleteCheckins } = await adminClient
      .from("fleet_checkins")
      .select("id, vehicle_id, driver_user_id, km_reported, needs_maintenance, tools_ok")
      .eq("status", "pending")
      .eq("checkin_date", todayStr);

    if (!incompleteCheckins || incompleteCheckins.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum check-in pendente hoje", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profiles and vehicles
    const driverUserIds = [...new Set(incompleteCheckins.map(c => c.driver_user_id).filter(Boolean))];
    const vehicleIds = [...new Set(incompleteCheckins.map(c => c.vehicle_id))];

    const [{ data: profiles }, { data: vehicles }] = await Promise.all([
      adminClient.from("profiles").select("user_id, name, whatsapp_number").in("user_id", driverUserIds),
      adminClient.from("fleet_vehicles").select("id, name, plate").in("id", vehicleIds),
    ]);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
    const vehicleMap = new Map((vehicles || []).map(v => [v.id, v]));

    const results: Array<{ vehicle: string; driver: string; status: string; error?: string }> = [];

    for (const checkin of incompleteCheckins) {
      const profile = checkin.driver_user_id ? profileMap.get(checkin.driver_user_id) : null;
      const vehicle = vehicleMap.get(checkin.vehicle_id);

      if (!profile?.whatsapp_number) {
        results.push({ vehicle: vehicle?.name || "?", driver: profile?.name || "?", status: "skipped", error: "Sem WhatsApp" });
        continue;
      }

      // Determine missing fields
      const missing: string[] = [];
      if (!checkin.km_reported) missing.push("📸 KM (envie foto do painel ou digite)");
      if (checkin.needs_maintenance === null) missing.push("🔧 Manutenção (sim/não ou descreva o problema)");
      if (checkin.tools_ok === null) missing.push("🧰 Ferramentas (completas sim/não)");

      if (missing.length === 0) {
        // All fields filled, mark as answered
        await adminClient.from("fleet_checkins").update({ status: "answered" }).eq("id", checkin.id);
        continue;
      }

      const vehicleName = vehicle ? `${vehicle.name} (${vehicle.plate})` : "seu veículo";
      let message = `⏰ *Lembrete de Check-in — ${vehicleName}*\n\n`;
      message += `Seu check-in ainda está incompleto. Falta responder:\n\n`;
      message += missing.map((m, i) => `${i + 1}. ${m}`).join("\n");
      message += `\n\nResponda aqui mesmo pelo WhatsApp! 👆`;

      try {
        const zapiUrl = `https://api.z-api.io/instances/${zapiConfig.instance_id}/token/${zapiConfig.token}/send-text`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (zapiConfig.client_token) headers["Client-Token"] = zapiConfig.client_token;

        const response = await fetch(zapiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ phone: profile.whatsapp_number.replace(/\D/g, ""), message }),
        });

        const responseData = await response.json();
        results.push({
          vehicle: vehicle?.name || "?",
          driver: profile.name,
          status: response.ok ? "sent" : "error",
          error: response.ok ? undefined : JSON.stringify(responseData),
        });
      } catch (err: any) {
        results.push({ vehicle: vehicle?.name || "?", driver: profile.name, status: "error", error: err.message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total: incompleteCheckins.length,
      sent: results.filter(r => r.status === "sent").length,
      details: results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error in notify-checkin-reminder:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
