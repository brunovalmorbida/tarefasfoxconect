import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (error) {
    return new Response(
      `<html><body><script>window.opener?.postMessage({type:'google-drive-error',error:'${error}'},'*');window.close();</script><p>Erro: ${error}. Feche esta janela.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code) {
    return new Response("Missing code parameter", { status: 400, headers: corsHeaders });
  }

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return new Response("Google credentials not configured", { status: 500, headers: corsHeaders });
  }

  try {
    // Exchange code for tokens
    const redirectUri = `${SUPABASE_URL}/functions/v1/google-drive-callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    console.log("Token exchange response status:", tokenRes.status);
    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
    }

    // Get user info
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userInfo = await userInfoRes.json();
    console.log("User info:", userInfo.email);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Create or find the root folder for TaskFox
    let rootFolderId: string | null = null;
    const folderMapping: Record<string, string> = {};

    try {
      const searchQuery = encodeURIComponent("name='TaskFox Social Media' and mimeType='application/vnd.google-apps.folder' and trashed=false");
      const folderRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${searchQuery}`,
        { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
      );
      const folderData = await folderRes.json();
      console.log("Root folder search result:", JSON.stringify(folderData));

      if (folderData.files && folderData.files.length > 0) {
        rootFolderId = folderData.files[0].id;
        console.log("Found existing root folder:", rootFolderId);
      } else {
        // Create root folder
        const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "TaskFox Social Media",
            mimeType: "application/vnd.google-apps.folder",
          }),
        });
        const created = await createRes.json();
        console.log("Created root folder:", JSON.stringify(created));
        rootFolderId = created.id;
      }

      // Create subfolders for pipeline stages
      if (rootFolderId) {
        const stages = ["Ideias", "Gravando", "Editando", "Pronto para Postar", "Publicado"];

        for (const stage of stages) {
          try {
            const stageQuery = encodeURIComponent(`name='${stage}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
            const searchRes = await fetch(
              `https://www.googleapis.com/drive/v3/files?q=${stageQuery}`,
              { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
            );
            const searchData = await searchRes.json();
            console.log(`Stage '${stage}' search:`, JSON.stringify(searchData));

            if (searchData.files && searchData.files.length > 0) {
              folderMapping[stage] = searchData.files[0].id;
            } else {
              const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${tokenData.access_token}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  name: stage,
                  mimeType: "application/vnd.google-apps.folder",
                  parents: [rootFolderId],
                }),
              });
              const created = await createRes.json();
              console.log(`Created stage folder '${stage}':`, JSON.stringify(created));
              if (created.id) {
                folderMapping[stage] = created.id;
              }
            }
          } catch (stageErr) {
            console.error(`Error creating stage folder '${stage}':`, stageErr);
          }
        }
      }
    } catch (folderErr) {
      console.error("Error creating Drive folders:", folderErr);
    }

    console.log("Final rootFolderId:", rootFolderId);
    console.log("Final folderMapping:", JSON.stringify(folderMapping));

    // Upsert config
    const configData = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || null,
      token_expires_at: expiresAt,
      root_folder_id: rootFolderId,
      folder_mapping: folderMapping,
      is_connected: true,
      connected_email: userInfo.email,
    };

    const { data: existing } = await supabase
      .from("google_drive_config")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error: updateError } = await supabase
        .from("google_drive_config")
        .update(configData)
        .eq("id", existing.id);
      console.log("Update result error:", updateError);
    } else {
      const { error: insertError } = await supabase
        .from("google_drive_config")
        .insert(configData);
      console.log("Insert result error:", insertError);
    }

    return new Response(
      `<html><body><script>window.opener?.postMessage({type:'google-drive-connected',email:'${userInfo.email}'},'*');window.close();</script><p>✅ Google Drive conectado com sucesso! Feche esta janela.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    console.error("Google Drive callback error:", err);
    return new Response(
      `<html><body><script>window.opener?.postMessage({type:'google-drive-error',error:'${(err as Error).message}'},'*');window.close();</script><p>Erro na conexão. Feche esta janela.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }
});
