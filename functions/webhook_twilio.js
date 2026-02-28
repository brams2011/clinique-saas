module.exports = async function(req) {
  if (req.method !== "POST") return new Response("", {status:405});
  const SURL = Deno.env.get("SUPABASE_URL") ?? "http://postgrest:3000";
  const SKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const FUNC_BASE = Deno.env.get("DENO_RUNTIME_URL") ?? "http://deno:7133";
  const INTERNAL_TOKEN = Deno.env.get("INTERNAL_API_TOKEN") ?? "";
  const IP = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const DH = {Authorization:"Bearer "+SKEY,"Content-Type":"application/json"};

  async function pg(path, opts={}) {
    return fetch(SURL + path, {headers:{...DH,...(opts.headers??{})}, method:opts.method??"GET", body:opts.body});
  }
  function parseForm(raw) {
    const p = {};
    for (const pair of raw.split("&")) {
      const idx = pair.indexOf("=");
      if (idx < 0) continue;
      const k = decodeURIComponent(pair.slice(0,idx).replace(/\+/g," "));
      const v = decodeURIComponent(pair.slice(idx+1).replace(/\+/g," "));
      if (k) p[k] = v;
    }
    return p;
  }

  const raw = await req.text();
  const params = parseForm(raw);

  // Inbound Voice Call → Connect to ElevenLabs agent
  if (params.CallSid) {
    const AGENT_ID = Deno.env.get("ELEVENLABS_AGENT_ID") ?? "agent_6401k7drd5gxfnwsdx6p5gnre8ma";
    await pg("/logs", {method:"POST", body:JSON.stringify({event_type:"voice_call_inbound",severity:"info",payload:{call_sid:params.CallSid,from:params.From,to:params.To,status:params.CallStatus},function_name:"webhook_twilio",ip_address:IP})});
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Connect><Stream url="wss://api.elevenlabs.io/v1/convai/twilio?agent_id=${AGENT_ID}" /></Connect></Response>`,
      {status:200, headers:{"Content-Type":"text/xml"}}
    );
  }

  // SMS status callback (delivery report)
  if (params.MessageStatus) {
    await pg("/logs", {method:"POST", body:JSON.stringify({event_type:"sms_status",severity:"info",payload:{sid:params.MessageSid,status:params.MessageStatus,to:params.To,from:params.From},function_name:"webhook_twilio",ip_address:IP})});
    return new Response("", {status:204});
  }

  // Inbound SMS
  if (params.Body && params.From) {
    const cmd = params.Body.trim().toLowerCase();
    await pg("/logs", {method:"POST", body:JSON.stringify({event_type:"sms_inbound",severity:"info",payload:{from:params.From,body:params.Body},function_name:"webhook_twilio",ip_address:IP})});

    if (cmd === "annuler" || cmd === "cancel" || cmd === "annule" || cmd === "stop") {
      const clRes = await pg("/clinic_patients?phone=eq."+encodeURIComponent(params.From)+"&select=id");
      const clRows = await clRes.json();
      if (clRows.length > 0) {
        const clientId = clRows[0].id;
        const apptRes = await pg("/clinic_appointments?patient_id=eq."+clientId+"&status=in.(scheduled,confirmed)&start_time=gt."+new Date().toISOString()+"&order=start_time.asc&limit=1&select=id");
        const apptRows = await apptRes.json();
        if (apptRows.length > 0) {
          await fetch(FUNC_BASE+"/cancel_appointment", {
            method:"POST",
            headers:{Authorization:"Bearer "+INTERNAL_TOKEN,"Content-Type":"application/json"},
            body:JSON.stringify({appointment_id:apptRows[0].id,reason:"SMS cancel"})
          }).catch(e=>console.error("Cancel via SMS failed:",e.message));
        }
      }
    }

    return new Response('<?xml version="1.0"?><Response><Message>Merci. Pour reprendre RDV appelez-nous. - Cinique</Message></Response>', {
      status:200,
      headers:{"Content-Type":"text/xml"}
    });
  }

  return new Response("", {status:204});
};
