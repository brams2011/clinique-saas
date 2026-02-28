module.exports = async function(req) {
  if (req.method !== "POST") return resp({error:"Method not allowed"}, 405);

  const SURL    = Deno.env.get("SUPABASE_URL") ?? "http://postgrest:3000";
  const SKEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const JWTKEY  = Deno.env.get("JWT_SECRET") ?? "";
  const ORKEY   = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  const IURL    = Deno.env.get("INSFORGE_INTERNAL_URL") ?? "http://insforge:7130";
  const API_KEY = Deno.env.get("API_KEY") ?? "";

  function resp(body, status=200) {
    return new Response(JSON.stringify(body), {status, headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}});
  }
  if (req.method === "OPTIONS") return new Response(null, {status:204, headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"Authorization,Content-Type"}});

  async function pg(path, opts={}) {
    const svcHeaders = {Authorization:"Bearer "+SKEY,"Content-Type":"application/json",...(opts.headers??{})};
    return fetch(SURL+path, {method:opts.method??"GET", headers:svcHeaders, body:opts.body});
  }
  async function verifyJWT(token) {
    if (!token) return null;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const pad = s => s+"=".repeat((4-s.length%4)%4);
      const payload = JSON.parse(atob(pad(parts[1].replace(/-/g,"+").replace(/_/g,"/"))));
      if (payload.exp && payload.exp < Date.now()/1000) return null;
      if (!JWTKEY) return payload;
      const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(JWTKEY),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
      const sigBytes = Uint8Array.from(atob(pad(parts[2].replace(/-/g,"+").replace(/_/g,"/"))).split("").map(c=>c.charCodeAt(0)));
      const ok = await crypto.subtle.verify("HMAC",key,sigBytes,new TextEncoder().encode(parts[0]+"."+parts[1]));
      return ok ? payload : null;
    } catch { return null; }
  }

  // Auth
  const token = (req.headers.get("Authorization")??"").replace(/^Bearer\s+/i,"").trim();
  const jwt = await verifyJWT(token);
  if (!jwt || !jwt.sub) return resp({error:"Unauthorized"}, 401);
  const userId = jwt.sub;

  // Parse body
  let body; try { body = await req.json(); } catch { return resp({error:"Invalid JSON"}, 400); }
  const {conversation_id, message, image_key} = body;

  if (!conversation_id || !message?.trim()) return resp({error:"conversation_id and message required"}, 422);
  if (typeof message !== "string" || message.length > 32000) return resp({error:"message too long (max 32000 chars)"}, 422);
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(conversation_id)) return resp({error:"Invalid conversation_id"}, 422);

  // Verify conversation ownership
  const convRes = await pg(`/chat_conversations?id=eq.${conversation_id}&user_id=eq.${userId}&select=id`);
  const convRows = await convRes.json();
  if (!Array.isArray(convRows) || convRows.length === 0) return resp({error:"Conversation not found"}, 404);

  // Fetch history (last 20 messages)
  const histRes = await pg(`/chat_messages?conversation_id=eq.${conversation_id}&order=created_at.desc&limit=20&select=role,content,image_key`);
  const histRaw = await histRes.json();
  const history = Array.isArray(histRaw) ? histRaw.reverse() : [];

  // Save user message first
  const userMsgBody = {conversation_id, user_id:userId, role:"user", content:message.trim(), image_key:image_key??null};
  const umRes = await pg("/chat_messages", {method:"POST", headers:{Prefer:"return=representation"}, body:JSON.stringify(userMsgBody)});
  const umRows = await umRes.json();
  const userMessage = Array.isArray(umRows) ? umRows[0] : umRows;

  // Build OpenRouter messages
  const orMessages = [];
  // System prompt
  orMessages.push({role:"system", content:"You are a helpful AI assistant. Be concise and clear."});
  // History
  for (const h of history) {
    if (h.image_key && h.role === "user") {
      // Image in history — just reference it textually for now
      orMessages.push({role:h.role, content:[{type:"text",text:h.content||"[image]"}]});
    } else {
      orMessages.push({role:h.role, content:h.content});
    }
  }
  // Current user message (with optional image)
  if (image_key) {
    // Fetch image from InsForge storage as base64
    let imageContent = [{type:"text",text:message.trim()}];
    try {
      const imgRes = await fetch(`${IURL}/api/storage/buckets/chat-images/objects/${image_key}`, {
        headers:{Authorization:"Bearer "+(API_KEY||SKEY)}
      });
      if (imgRes.ok) {
        const buf = await imgRes.arrayBuffer();
        const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const ct = imgRes.headers.get("content-type") || "image/jpeg";
        imageContent = [
          {type:"image_url", image_url:{url:`data:${ct};base64,${b64}`}},
          {type:"text", text:message.trim()}
        ];
      }
    } catch (_) {}
    orMessages.push({role:"user", content:imageContent});
  } else {
    orMessages.push({role:"user", content:message.trim()});
  }

  // Call OpenRouter
  let assistantContent = "";
  if (!ORKEY) {
    assistantContent = "⚠️ OPENROUTER_API_KEY not configured. Please set it in InsForge secrets.";
  } else {
    try {
      const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method:"POST",
        headers:{
          "Authorization":"Bearer "+ORKEY,
          "Content-Type":"application/json",
          "HTTP-Referer":"http://localhost:5173",
          "X-Title":"Cinique Chatbot"
        },
        body:JSON.stringify({
          model:"anthropic/claude-3.5-haiku",
          messages:orMessages,
          max_tokens:2048
        })
      });
      const orData = await orRes.json();
      if (orData?.choices?.[0]?.message?.content) {
        assistantContent = orData.choices[0].message.content;
      } else if (orData?.error) {
        assistantContent = `AI error: ${orData.error.message ?? JSON.stringify(orData.error)}`;
      } else {
        assistantContent = "No response from AI.";
      }
    } catch (e) {
      assistantContent = `Network error: ${e.message}`;
    }
  }

  // Save assistant message
  const asMsgBody = {conversation_id, user_id:userId, role:"assistant", content:assistantContent};
  const amRes = await pg("/chat_messages", {method:"POST", headers:{Prefer:"return=representation"}, body:JSON.stringify(asMsgBody)});
  const amRows = await amRes.json();
  const assistantMessage = Array.isArray(amRows) ? amRows[0] : amRows;

  // Update conversation updated_at
  await pg(`/chat_conversations?id=eq.${conversation_id}`, {
    method:"PATCH",
    headers:{Prefer:"return=minimal"},
    body:JSON.stringify({updated_at:new Date().toISOString()})
  });

  return resp({user_message:userMessage, assistant_message:assistantMessage});
};
