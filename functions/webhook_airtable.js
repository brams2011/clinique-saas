module.exports = async function(req) {
  if (req.method !== "POST") return new Response(JSON.stringify({error:"Method not allowed"}), {status:405,headers:{"Content-Type":"application/json"}});
  const SURL = Deno.env.get("SUPABASE_URL") ?? "http://postgrest:3000";
  const SKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const FUNC_BASE = Deno.env.get("DENO_RUNTIME_URL") ?? "http://deno:7133";
  const INTERNAL_TOKEN = Deno.env.get("INTERNAL_API_TOKEN") ?? "";
  const IP = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const DH = {Authorization:"Bearer "+SKEY,"Content-Type":"application/json"};

  async function pg(path, opts={}) {
    return fetch(SURL + path, {headers:{...DH,...(opts.headers??{})}, method:opts.method??"GET", body:opts.body});
  }

  let payload;
  try { payload = await req.json(); }
  catch { return new Response(JSON.stringify({error:"Invalid JSON"}), {status:400,headers:{"Content-Type":"application/json"}}); }

  const action = String(payload.action ?? "");
  const idem = String(payload.record_id ?? crypto.randomUUID());

  await pg("/logs", {method:"POST", body:JSON.stringify({event_type:"webhook_airtable_received",severity:"info",payload:{action},function_name:"webhook_airtable",ip_address:IP})});

  if (action === "create_appointment") {
    const f = payload.fields ?? {};
    if (!f.client_phone || !f.date_time)
      return new Response(JSON.stringify({error:"Missing client_phone or date_time"}), {status:422,headers:{"Content-Type":"application/json"}});
    const r = await fetch(FUNC_BASE+"/create_appointment", {
      method:"POST",
      headers:{Authorization:"Bearer "+INTERNAL_TOKEN,"Content-Type":"application/json","x-idempotency-key":idem},
      body:JSON.stringify({
        client_name: String(f.client_name ?? "Unknown"),
        client_phone: String(f.client_phone),
        client_email: f.client_email ? String(f.client_email) : undefined,
        date_time: String(f.date_time),
        source: "api",
        notes: f.notes ? String(f.notes) : undefined
      })
    });
    return new Response(await r.text(), {status:r.status,headers:{"Content-Type":"application/json"}});
  }

  if (action === "cancel_appointment") {
    const id = String(payload.appointment_id ?? "");
    if (!id) return new Response(JSON.stringify({error:"appointment_id required"}), {status:422,headers:{"Content-Type":"application/json"}});
    const r = await fetch(FUNC_BASE+"/cancel_appointment", {
      method:"POST",
      headers:{Authorization:"Bearer "+INTERNAL_TOKEN,"Content-Type":"application/json"},
      body:JSON.stringify({appointment_id:id, reason:String(payload.reason??"")})
    });
    return new Response(await r.text(), {status:r.status,headers:{"Content-Type":"application/json"}});
  }

  return new Response(JSON.stringify({received:true, processed:false, reason:"unknown action: "+action}), {status:200,headers:{"Content-Type":"application/json"}});
};
