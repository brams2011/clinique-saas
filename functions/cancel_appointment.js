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
  const {appointment_id, reason=""} = body;

  if (!appointment_id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appointment_id))
    return resp({error:"Valid appointment_id (UUID) required"}, 422);

  // Fetch appointment with patient
  const apptRes = await pg("/clinic_appointments?id=eq."+appointment_id+"&select=id,status,start_time,google_event_id,patient_id");
  const apptRows = await apptRes.json();
  if (!apptRows.length) return resp({error:"Appointment not found"}, 404);
  const appt = apptRows[0];

  // Idempotent: already cancelled
  if (appt.status === "cancelled") return resp({cancelled:true, appointment_id:appt.id, already_cancelled:true});

  // Guard: past appointment
  if (new Date(appt.start_time) < new Date()) return resp({error:"Cannot cancel past appointment"}, 409);

  // Get patient phone for SMS
  let clientPhone = null;
  if (appt.patient_id) {
    const clRes = await pg("/clinic_patients?id=eq."+appt.patient_id+"&select=phone,first_name,last_name");
    const clRows = await clRes.json();
    if (clRows.length) clientPhone = clRows[0].phone;
  }

  // Delete Google Calendar event
  if (appt.google_event_id) {
    const GID = Deno.env.get("GOOGLE_CLIENT_ID")??"", GSEC = Deno.env.get("GOOGLE_SECRET")??"";
    const GREF = Deno.env.get("GOOGLE_REFRESH_TOKEN")??"", GCAL = Deno.env.get("GOOGLE_CALENDAR_ID")??"";
    if (GID && GSEC && GREF && GCAL) {
      try {
        const tr = await fetch("https://oauth2.googleapis.com/token", {method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:new URLSearchParams({client_id:GID,client_secret:GSEC,refresh_token:GREF,grant_type:"refresh_token"})});
        if (tr.ok) {
          const {access_token:at} = await tr.json();
          const delR = await fetch("https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(GCAL)+"/events/"+appt.google_event_id, {method:"DELETE", headers:{Authorization:"Bearer "+at}});
          if (!delR.ok && delR.status !== 404 && delR.status !== 410) console.error("GCal delete failed:", delR.status);
        }
      } catch(e) { console.error("GCal cancel error:", e.message); }
    }
  }

  // Update DB status
  await pg("/clinic_appointments?id=eq."+appointment_id, {method:"PATCH", headers:{...DH,Prefer:"return=minimal"}, body:JSON.stringify({status:"cancelled"})});

  // Async Twilio SMS
  const TSID=Deno.env.get("TWILIO_SID")??"", TTOK=Deno.env.get("TWILIO_TOKEN")??"", TPHONE=Deno.env.get("TWILIO_PHONE")??"";
  if (clientPhone && TSID && TTOK && TPHONE) {
    (async () => {
      const msg = "Votre rendez-vous a ete annule. Pour reprendre RDV appelez-nous. - Cinique";
      let smsSent = false;
      for (let i=0;i<3;i++) {
        try {
          const r = await fetch("https://api.twilio.com/2010-04-01/Accounts/"+TSID+"/Messages.json", {method:"POST", headers:{Authorization:"Basic "+btoa(TSID+":"+TTOK),"Content-Type":"application/x-www-form-urlencoded"}, body:new URLSearchParams({To:clientPhone,From:TPHONE,Body:msg})});
          if (r.ok) { smsSent = true; break; }
          const errBody = await r.json().catch(()=>({}));
          console.error("Twilio cancel SMS error attempt "+(i+1)+":", errBody.code, errBody.message);
          if (errBody.code === 21211 || errBody.code === 21614) break;
          await new Promise(r=>setTimeout(r,500*(2**i)));
        } catch(e) {
          console.error("Twilio cancel SMS exception attempt "+(i+1)+":", e.message);
          await new Promise(r=>setTimeout(r,500*(2**i)));
        }
      }
      if (!smsSent) {
        await pg("/logs", {method:"POST", body:JSON.stringify({event_type:"sms_cancel_failed",severity:"warn",payload:{to:clientPhone,appointment_id},function_name:"cancel_appointment"})});
      }
    })();
  }

  // Log
  await pg("/logs", {method:"POST", body:JSON.stringify({event_type:"appointment_cancelled",severity:"info",payload:{appointment_id,reason:String(reason),google_event_id:appt.google_event_id,patient_id:appt.patient_id},function_name:"cancel_appointment",ip_address:IP})});

  return resp({cancelled:true, appointment_id, status:"cancelled"});
};
