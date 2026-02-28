module.exports = async function(req) {
  const state = req.headers.get("x-goog-resource-state");
  if (state === "sync") return new Response("", {status:200});
  if (req.method !== "POST") return new Response("", {status:405});

  const SURL = Deno.env.get("SUPABASE_URL") ?? "http://postgrest:3000";
  const SKEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const IP = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const DH = {Authorization:"Bearer "+SKEY,"Content-Type":"application/json"};

  async function pg(path, opts={}) {
    return fetch(SURL + path, {headers:{...DH,...(opts.headers??{})}, method:opts.method??"GET", body:opts.body});
  }

  try {
    const GID = Deno.env.get("GOOGLE_CLIENT_ID")??"", GSEC = Deno.env.get("GOOGLE_SECRET")??"";
    const GREF = Deno.env.get("GOOGLE_REFRESH_TOKEN")??"", GCAL = Deno.env.get("GOOGLE_CALENDAR_ID")??"";
    if (!GID || !GSEC || !GREF || !GCAL) return new Response("", {status:200});

    const tr = await fetch("https://oauth2.googleapis.com/token", {
      method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({client_id:GID,client_secret:GSEC,refresh_token:GREF,grant_type:"refresh_token"})
    });
    if (!tr.ok) throw new Error("Token refresh failed: "+tr.status);
    const {access_token:at} = await tr.json();

    const updMin = new Date(Date.now()-5*60000).toISOString();
    const listR = await fetch("https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(GCAL)+"/events?"+new URLSearchParams({updatedMin,singleEvents:"true",orderBy:"updated"}), {
      headers:{Authorization:"Bearer "+at}
    });
    if (!listR.ok) throw new Error("Events list failed: "+listR.status);
    const {items=[]} = await listR.json();

    for (const ev of items) {
      if (ev.status !== "cancelled") continue;
      const apptRes = await pg("/appointments?google_event_id=eq."+encodeURIComponent(ev.id)+"&select=id,status");
      const apptRows = await apptRes.json();
      if (!apptRows.length || apptRows[0].status === "cancelled") continue;
      const appt = apptRows[0];
      await pg("/appointments?id=eq."+appt.id, {method:"PATCH", headers:{...DH,Prefer:"return=minimal"}, body:JSON.stringify({status:"cancelled"})});
      await pg("/logs", {method:"POST", body:JSON.stringify({event_type:"appt_cancelled_via_google",severity:"info",payload:{appointment_id:appt.id,google_event_id:ev.id},function_name:"webhook_google",ip_address:IP})});
    }
  } catch(e) {
    await pg("/logs", {method:"POST", body:JSON.stringify({event_type:"google_webhook_error",severity:"warn",payload:{error:String(e)},function_name:"webhook_google"})}).catch(()=>{});
  }

  return new Response("", {status:200});
};
