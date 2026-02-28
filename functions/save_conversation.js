module.exports = async function(req) {
  if (req.method !== "POST") return resp({error:"Method not allowed"}, 405);
  const SURL = Deno.env.get("SUPABASE_URL") ?? "http://postgrest:3000";
  const SKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const JWT_SECRET = Deno.env.get("JWT_SECRET") ?? "";
  const IP = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const DH = {Authorization:"Bearer "+SKEY,"Content-Type":"application/json"};

  function resp(body, status=200) {
    return new Response(JSON.stringify(body), {status, headers:{"Content-Type":"application/json"}});
  }
  async function pg(path, opts={}) {
    return fetch(SURL + path, {headers:{...DH,...(opts.headers??{})}, method:opts.method??"GET", body:opts.body});
  }
  async function verifyJWT(token) {
    if (!token) return null;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const pad = s => s + "=".repeat((4 - s.length%4)%4);
      const payload = JSON.parse(atob(pad(parts[1].replace(/-/g,"+").replace(/_/g,"/"))));
      if (payload.exp && payload.exp < Date.now()/1000) return null;
      if (!JWT_SECRET) return payload;
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(JWT_SECRET), {name:"HMAC",hash:"SHA-256"}, false, ["verify"]);
      const sigBytes = Uint8Array.from(atob(pad(parts[2].replace(/-/g,"+").replace(/_/g,"/"))).split("").map(c=>c.charCodeAt(0)));
      const ok = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(parts[0]+"."+parts[1]));
      return ok ? payload : null;
    } catch { return null; }
  }

  // Auth
  const token = (req.headers.get("Authorization")??"").replace("Bearer ","").trim();
  const jwtPayload = await verifyJWT(token);
  if (!jwtPayload) return resp({error:"Unauthorized"}, 401);

  let body; try { body = await req.json(); } catch { return resp({error:"Invalid JSON"}, 400); }
  const {transcript, client_phone, client_id: bodyClientId, appointment_id, raw_payload} = body;

  if (!transcript || typeof transcript !== "string") return resp({error:"transcript required"}, 422);
  if (transcript.length > 100000) return resp({error:"transcript too long (max 100k chars)"}, 422);

  // Resolve client_id from phone if not provided
  let clientId = bodyClientId ?? null;
  if (!clientId && client_phone) {
    const clRes = await pg("/clients?phone=eq."+encodeURIComponent(String(client_phone))+"&select=id");
    const clRows = await clRes.json();
    if (clRows.length) clientId = clRows[0].id;
  }

  // Extractive AI summary: first 3 sentences (fallback when ElevenLabs not used)
  let aiSummary = "";
  const ELKEY = Deno.env.get("ELEVENLABS_API_KEY") ?? "";
  if (ELKEY && ELKEY.length > 10) {
    try {
      const sentences = transcript.match(/[^.!?]+[.!?]+/g) ?? [];
      aiSummary = sentences.slice(0,3).join(" ").trim() || transcript.slice(0,300);
    } catch { aiSummary = transcript.slice(0,300); }
  } else {
    const sentences = transcript.match(/[^.!?]+[.!?]+/g) ?? [];
    aiSummary = sentences.slice(0,3).join(" ").trim() || transcript.slice(0,300);
  }

  // Insert conversation
  const convObj = {transcript, ai_summary:aiSummary};
  if (clientId) convObj.client_id = clientId;
  if (appointment_id) convObj.appointment_id = appointment_id;
  if (raw_payload) convObj.raw_payload = raw_payload;

  const insR = await pg("/conversations", {method:"POST", headers:{...DH,Prefer:"return=representation"}, body:JSON.stringify(convObj)});
  if (!insR.ok) return resp({error:"DB insert failed", detail:await insR.text()}, 500);
  const [conv] = await insR.json();

  // Airtable sync
  const ATKEY = Deno.env.get("AIRTABLE_API_KEY") ?? "";
  const ATBASE = Deno.env.get("AIRTABLE_BASE_ID") ?? "";
  let airtableRecordId = null;
  if (ATKEY && ATBASE && !ATKEY.startsWith("patXXX")) {
    (async () => {
      for (let i=0;i<3;i++) {
        try {
          const r = await fetch("https://api.airtable.com/v0/"+ATBASE+"/Conversations", {
            method:"POST",
            headers:{Authorization:"Bearer "+ATKEY,"Content-Type":"application/json"},
            body:JSON.stringify({fields:{
              ConversationId: conv.id,
              Transcript: transcript.slice(0,10000),
              Summary: aiSummary,
              ClientPhone: client_phone ?? "",
              CreatedAt: conv.created_at ?? new Date().toISOString()
            }})
          });
          if (r.ok) {
            const atData = await r.json();
            airtableRecordId = atData.id ?? null;
            if (airtableRecordId) {
              await pg("/conversations?id=eq."+conv.id, {method:"PATCH", headers:{...DH,Prefer:"return=minimal"}, body:JSON.stringify({airtable_record_id:airtableRecordId})});
            }
            break;
          }
          await new Promise(r=>setTimeout(r,500*(2**i)));
        } catch(e) { await new Promise(r=>setTimeout(r,500*(2**i))); }
      }
    })();
  }

  // Log
  await pg("/logs", {method:"POST", body:JSON.stringify({event_type:"conversation_saved",severity:"info",payload:{conversation_id:conv.id,client_id:clientId},client_id:clientId,function_name:"save_conversation",ip_address:IP})});

  return resp({conversation_id:conv.id, ai_summary:aiSummary, airtable_record_id:airtableRecordId, client_id:clientId}, 201);
};
