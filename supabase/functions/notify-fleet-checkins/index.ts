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

    // Auth check — allow cron (anon key) or admin
    const authHeader = req.headers.get("Authorization");
    let isAuthorized = false;

    if (authHeader && !authHeader.includes(anonKey)) {
      const callerClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user: caller } } = await callerClient.auth.getUser();
      if (caller) {
        const adminClient = createClient(supabaseUrl, serviceRoleKey);
        const { data: role } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", caller.id)
          .eq("role", "admin")
          .maybeSingle();
        if (role) isAuthorized = true;
      }
    } else {
      isAuthorized = true; // cron/service call
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse body for test mode
    let testMode = false;
    let testPhone = "";
    let testVehicleIds: string[] = [];
    try {
      const body = await req.json();
      testMode = body?.testMode === true;
      testPhone = body?.testPhone || "";
      testVehicleIds = body?.vehicleIds || [];
    } catch {
      // No body (cron call)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Business hours check (BRT) — skip in test mode
    if (!testMode) {
      const _now = new Date();
      const _brtNow = new Date(_now.getTime() + (-3 * 60 + _now.getTimezoneOffset()) * 60000);
      const _dayOfWeek = _brtNow.getDay();
      const _totalMin = _brtNow.getHours() * 60 + _brtNow.getMinutes();

      const isBusinessHours = (() => {
        if (_dayOfWeek === 0) return false;
        if (_dayOfWeek === 6) return _totalMin >= 480 && _totalMin < 720;
        return _totalMin >= 510 && _totalMin < 1080;
      })();

      if (!isBusinessHours) {
        return new Response(JSON.stringify({ message: "Fora do horário comercial", skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 1. Get fleet settings
    const { data: settings } = await adminClient
      .from("fleet_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (!settings || !settings.auto_checkin_enabled) {
      return new Response(JSON.stringify({ message: "Check-in automático desativado", skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check if today matches the configured checkin day (skip in test mode)
    if (!testMode) {
      const _now2 = new Date();
      const brtNow = new Date(_now2.getTime() + (-3 * 60 + _now2.getTimezoneOffset()) * 60000);
      const todayDow = brtNow.getDay(); // 0=Sunday, 1=Monday...
      if (todayDow !== settings.checkin_day) {
        return new Response(JSON.stringify({ message: `Hoje não é dia de check-in (configurado: ${settings.checkin_day})`, skipped: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 3. Check Z-API
    const { data: zapiConfig } = await adminClient
      .from("zapi_config")
      .select("*")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!zapiConfig) {
      return new Response(JSON.stringify({ error: "Z-API não configurada ou inativa" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Get active vehicles with driver_user_id
    let vehicleQuery = adminClient
      .from("fleet_vehicles")
      .select("id, name, plate, driver_user_id, driver_id")
      .eq("status", "active")
      .not("driver_user_id", "is", null);

    // Filter by specific vehicle IDs in test mode
    if (testMode && testVehicleIds.length > 0) {
      vehicleQuery = vehicleQuery.in("id", testVehicleIds);
    }

    const { data: vehicles } = await vehicleQuery;

    if (!vehicles || vehicles.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhum veículo ativo com motorista vinculado", sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Get profiles (name + whatsapp) for all driver_user_ids
    const driverUserIds = [...new Set(vehicles.map(v => v.driver_user_id).filter(Boolean))];
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("user_id, name, whatsapp_number")
      .in("user_id", driverUserIds);

    const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));

    // 6. Also fetch legacy fleet_drivers for fallback name/phone
    const driverIds = [...new Set(vehicles.map(v => v.driver_id).filter(Boolean))];
    const { data: legacyDrivers } = driverIds.length > 0
      ? await adminClient.from("fleet_drivers").select("id, name, phone").in("id", driverIds)
      : { data: [] };
    const legacyDriverMap = new Map((legacyDrivers || []).map(d => [d.id, d]));

    // 7. Message template
    const defaultTemplate = `Bom dia, {nome}! 👋

📋 *Check-in semanal do veículo {veiculo} ({placa})*

Por favor, responda com as seguintes informações:

1️⃣ *KM atual:*
2️⃣ *Precisa de manutenção?* (sim ou não)
3️⃣ *Descrição* (se precisar de manutenção, descreva o problema)
4️⃣ *Ferramentas:* Todas as ferramentas estão completas? (sim ou não, se não, descreva o que está faltando)

Responda neste formato:
KM: ___
Manutenção: sim/não
Descrição: ___
Ferramentas: sim/não
Observação ferramentas: ___`;

    const template = settings.checkin_message_template || defaultTemplate;

    const todayStr = new Date().toISOString().slice(0, 10);
    const results: Array<{ vehicle: string; driver: string; phone: string; status: string; error?: string }> = [];

    for (const vehicle of vehicles) {
      const profile = vehicle.driver_user_id ? profileMap.get(vehicle.driver_user_id) : null;
      const legacyDriver = vehicle.driver_id ? legacyDriverMap.get(vehicle.driver_id) : null;

      const driverName = profile?.name || legacyDriver?.name || "Motorista";
      const phone = testMode && testPhone
        ? testPhone
        : (profile?.whatsapp_number || legacyDriver?.phone);

      if (!phone) {
        results.push({ vehicle: vehicle.name, driver: driverName, phone: "", status: "skipped", error: "Sem WhatsApp" });
        continue;
      }

      // Build message from template
      const message = template
        .replace(/\{nome\}/g, driverName)
        .replace(/\{veiculo\}/g, vehicle.name)
        .replace(/\{placa\}/g, vehicle.plate);

      // Send via Z-API
      try {
        const zapiUrl = `https://api.z-api.io/instances/${zapiConfig.instance_id}/token/${zapiConfig.token}/send-text`;
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (zapiConfig.client_token) headers["Client-Token"] = zapiConfig.client_token;

        const response = await fetch(zapiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ phone: phone.replace(/\D/g, ""), message }),
        });

        const responseData = await response.json();

        if (response.ok) {
          // Create pending checkin record
          await adminClient.from("fleet_checkins").insert({
            vehicle_id: vehicle.id,
            driver_id: vehicle.driver_id || vehicle.id, // fallback
            driver_user_id: vehicle.driver_user_id,
            checkin_date: todayStr,
            status: "pending",
          });

          results.push({ vehicle: vehicle.name, driver: driverName, phone, status: "sent" });
        } else {
          results.push({ vehicle: vehicle.name, driver: driverName, phone, status: "error", error: JSON.stringify(responseData) });
        }
      } catch (sendError: any) {
        results.push({ vehicle: vehicle.name, driver: driverName, phone, status: "error", error: sendError.message });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_vehicles: vehicles.length,
      sent: results.filter(r => r.status === "sent").length,
      errors: results.filter(r => r.status === "error").length,
      skipped: results.filter(r => r.status === "skipped").length,
      details: results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error in notify-fleet-checkins:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
