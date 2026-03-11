import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function refreshTokenIfNeeded(supabase: any, config: any) {
  const now = new Date();
  const expiresAt = new Date(config.token_expires_at);
  
  // Refresh if expires in less than 5 minutes
  if (now.getTime() > expiresAt.getTime() - 5 * 60 * 1000) {
    const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
    const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!config.refresh_token) {
      throw new Error("No refresh token available. Please reconnect Google Drive.");
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        refresh_token: config.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(`Token refresh failed: ${JSON.stringify(tokenData)}`);
    }

    const newExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    await supabase
      .from("google_drive_config")
      .update({
        access_token: tokenData.access_token,
        token_expires_at: newExpiresAt,
      })
      .eq("id", config.id);

    return tokenData.access_token;
  }

  return config.access_token;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Verify auth
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get drive config
  const { data: config } = await supabase
    .from("google_drive_config")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (!config || !config.is_connected) {
    return new Response(JSON.stringify({ error: "Google Drive not connected" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const accessToken = await refreshTokenIfNeeded(supabase, config);
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "list-files": {
        const { folderId } = body;
        const targetFolder = folderId || config.root_folder_id;
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files?q='${targetFolder}' in parents and trashed=false&fields=files(id,name,mimeType,webViewLink,iconLink,thumbnailLink,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=50`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = await res.json();
        return new Response(JSON.stringify({ files: data.files || [], folderMapping: config.folder_mapping }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "upload": {
        const { fileName, fileBase64, mimeType, folderId } = body;
        const targetFolder = folderId || config.root_folder_id;

        // Create file metadata
        const metadata = {
          name: fileName,
          parents: [targetFolder],
        };

        // Convert base64 to bytes
        const binaryString = atob(fileBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Multipart upload
        const boundary = "---boundary" + Date.now();
        const metadataStr = JSON.stringify(metadata);
        
        const bodyParts = [
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataStr}\r\n`,
          `--${boundary}\r\nContent-Type: ${mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${fileBase64}\r\n`,
          `--${boundary}--`,
        ];

        const uploadRes = await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": `multipart/related; boundary=${boundary}`,
            },
            body: bodyParts.join(""),
          }
        );

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(`Upload failed: ${JSON.stringify(uploadData)}`);
        }

        return new Response(JSON.stringify({ file: uploadData }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create-folder": {
        const { folderName, parentId } = body;
        const res = await fetch("https://www.googleapis.com/drive/v3/files", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: folderName,
            mimeType: "application/vnd.google-apps.folder",
            parents: [parentId || config.root_folder_id],
          }),
        });
        const data = await res.json();
        return new Response(JSON.stringify({ folder: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get-status": {
        return new Response(JSON.stringify({
          connected: true,
          email: config.connected_email,
          rootFolderId: config.root_folder_id,
          folderMapping: config.folder_mapping,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    console.error("Google Drive API error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
