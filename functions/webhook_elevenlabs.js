module.exports = async function(req) {
  if (req.method !== "POST") return new Response("", {status:405});
  const SURL = Deno.env.get("SUPABASE_URL") ?? "http://postgrest:3000";
  const SKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const FUNC_BASE = Deno.env.get("DENO_RUNTIME_URL") ?? "http://deno:7133";
  const INTERNAL_TOKEN = Deno.env.get("INTERNAL_API_TOKEN") ?? "";
  const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET_ELEVEN") ?? "";
  const IP = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const DH = {Authorization:"Bearer "+SKEY,"Content-Type":"application/json"};

  async function pg(path, opts={}) {
    return fetch(SURL + path, {headers:{...DH,...(opts.headers??{})}, method:opts.method??"GET", body:opts.body});
  }

  const rawBody = await req.text();

  // HMAC-SHA256 signature verification
  if (WEBHOOK_SECRET) {
    const sig = req.headers.get("x-elevenlabs-signature") ?? "";
    const sigHex = sig.replace("sha256=","");
    try {
      const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(WEBHOOK_SECRET), {name:"HMAC",hash:"SHA-256"}, false, ["verify"]);
      const sigBytes = Uint8Array.from(sigHex.match(/.{2}/g).map(b=>parseInt(b,16)));
      const valid = await crypto.subtle.verify("HMAC", key, sigBytes, new TextEncoder().encode(rawBody));
      if (!valid) {
        await pg("/logs", {method:"POST", body:JSON.stringify({event_type:"elevenlabs_invalid_signature",severity:"warn",payload:{sig},function_name:"webhook_elevenlabs",ip_address:IP})});
        return new Response("", {status:200}); // Always 200 to ElevenLabs
      }
    } catch(e) { console.error("HMAC verify error:", e.message); }
  }

  let payload;
  try { payload = JSON.parse(rawBody); } catch { return new Response("", {status:200}); }

  const eventType = payload.type ?? payload.event_type ?? "";

  // Log raw event
  await pg("/logs", {method:"POST", body:JSON.stringify({event_type:"elevenlabs_webhook_received",severity:"info",payload:{event_type:eventType,conversation_id:payload.conversation_id??payload.data?.conversation_id??""},function_name:"webhook_elevenlabs",ip_address:IP})});

  // Only process call completion events
  const isCallCompleted = ["call.completed","conversation.completed","post_call_transcription"].includes(eventType);
  if (!isCallCompleted) return new Response(JSON.stringify({received:true,processed:false}), {status:200,headers:{"Content-Type":"application/json"}});

  const data = payload.data ?? payload;
  const convId = data.conversation_id ?? payload.conversation_id ?? "";

  // Serialize transcript — ElevenLabs sends an array of {role, message} objects
  const rawTranscript = data.transcript ?? data.full_transcript ?? "";
  let transcript = "";
  if (Array.isArray(rawTranscript)) {
    transcript = rawTranscript.map(t => {
      const role = t.role === "agent" ? "Agent" : "Patient";
      const text = t.message ?? t.text ?? t.content ?? "";
      return `${role}: ${text}`;
    }).join("\n");
  } else {
    transcript = String(rawTranscript);
  }

  // Extract collected data — ElevenLabs new format: data.analysis.data_collection_results[key] = {value, rationale}
  // Legacy format: data.extracted_variables[key] = "string"
  const collectedRaw = data.analysis?.data_collection_results
    ?? data.data_collection_results
    ?? data.extracted_variables
    ?? {};

  // Extract a field value from either format: {value, rationale} or plain string
  function getVal(obj, ...keys) {
    for (const k of keys) {
      const v = obj[k];
      if (v !== undefined && v !== null && v !== "") {
        if (typeof v === "object" && "value" in v) return String(v.value ?? "").trim();
        return String(v).trim();
      }
    }
    return "";
  }

  const clientName  = getVal(collectedRaw, "client_name","patient_name","name","nom") || String(data.caller_name ?? "");
  const clientPhone = getVal(collectedRaw, "client_phone","phone","telephone","tel") || String(data.caller_phone ?? "");
  const dateTimeRaw = getVal(collectedRaw, "date_time","appointment_date","appointment_time","datetime","date","rdv_date");
  const notes       = getVal(collectedRaw, "notes","reason","motif","raison");
  const clientEmail = getVal(collectedRaw, "client_email","email","courriel");

  // Normalize date — handle ISO, English, and French date formats
  function normalizeDate(str) {
    if (!str) return null;
    // Try standard parsing first (handles ISO 8601, English formats)
    const d = new Date(str);
    if (!isNaN(d.getTime())) return d.toISOString();

    // French month names → number (0-indexed)
    const months = {
      janvier:0, jan:0, février:1, fevrier:1, fev:1, mars:2, mar:2,
      avril:3, avr:3, mai:4, juin:5, juillet:6, juil:6,
      août:7, aout:7, septembre:8, sep:8, sept:8,
      octobre:9, oct:9, novembre:10, nov:10, décembre:11, decembre:11, dec:11
    };
    // Pattern: DD month [YYYY] [à|at|,] HH[h|:]MM
    const m = str.toLowerCase().match(/(\d{1,2})\s+(\w+)\s*(\d{4})?\D*(\d{1,2})[h:](\d{0,2})/);
    if (m) {
      const mon = months[m[2]];
      if (mon !== undefined) {
        const yr  = m[3] ? parseInt(m[3]) : new Date().getFullYear();
        const day = parseInt(m[1]);
        const hr  = parseInt(m[4]);
        const min = parseInt(m[5] || "0");
        const d2  = new Date(yr, mon, day, hr, min, 0);
        if (!isNaN(d2.getTime())) return d2.toISOString();
      }
    }
    return null;
  }

  const dateTime = normalizeDate(dateTimeRaw);

  // Process synchronously
  let apptResult = null;
  try {
    // Save conversation transcript
    if (transcript || rawBody) {
      await fetch(FUNC_BASE+"/save_conversation", {
        method:"POST",
        headers:{Authorization:"Bearer "+INTERNAL_TOKEN,"Content-Type":"application/json"},
        body:JSON.stringify({
          transcript: transcript || rawBody.slice(0,10000),
          client_phone: clientPhone || undefined,
          raw_payload: payload
        })
      });
    }

    // Create appointment only if we have phone + parseable date
    if (clientPhone && dateTime) {
      const idemKey = "eleven_"+(convId||Date.now());
      const ar = await fetch(FUNC_BASE+"/create_appointment", {
        method:"POST",
        headers:{Authorization:"Bearer "+INTERNAL_TOKEN,"Content-Type":"application/json","x-idempotency-key":idemKey},
        body:JSON.stringify({
          client_name:  clientName  || "Patient",
          client_phone: clientPhone,
          client_email: clientEmail || undefined,
          date_time:    dateTime,
          source:       "voice",
          notes:        notes || "RDV pris par agent vocal ElevenLabs"
        })
      });
      apptResult = await ar.json();
    } else {
      // Log missing data for debugging
      await pg("/logs", {method:"POST", body:JSON.stringify({
        event_type:"elevenlabs_incomplete_data",severity:"warn",
        payload:{has_phone:!!clientPhone,has_date:!!dateTime,date_raw:dateTimeRaw,name:clientName},
        function_name:"webhook_elevenlabs"
      })});
    }
  } catch(e) {
    await pg("/logs", {method:"POST", body:JSON.stringify({event_type:"elevenlabs_processing_error",severity:"error",payload:{error:e.message,conversation_id:convId},function_name:"webhook_elevenlabs"})});
  }

  return new Response(JSON.stringify({received:true,processed:true,conversation_id:convId,appointment:apptResult}), {status:200,headers:{"Content-Type":"application/json"}});
};
