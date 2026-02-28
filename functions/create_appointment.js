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

  // Rate limiting
  const rlRes = await pg("/rpc/check_rate_limit", {
    method:"POST",
    body:JSON.stringify({p_ip:IP??"0.0.0.0",p_endpoint:"create_appointment",p_max_hits:10,p_window_seconds:60})
  });
  const rl = await rlRes.json();
  if (rl === false) return resp({error:"Rate limit exceeded"}, 429);

  // Parse body
  let body; try { body = await req.json(); } catch { return resp({error:"Invalid JSON"}, 400); }
  const {client_name, client_phone, client_email, date_time, notes} = body;

  // Validation
  if (!client_name || !client_phone || !date_time) return resp({error:"client_name, client_phone, date_time required"}, 422);
  if (!/^\+?[1-9]\d{7,14}$/.test(String(client_phone))) return resp({error:"Invalid phone format"}, 422);
  const apptDate = new Date(date_time);
  if (isNaN(apptDate.getTime()) || apptDate <= new Date()) return resp({error:"date_time must be in the future"}, 422);
  if (apptDate > new Date(Date.now() + 365*24*3600000)) return resp({error:"date_time too far in future"}, 422);
  const endDate = new Date(apptDate.getTime() + 3600000); // +1h

  // Split full name into first/last
  const nameParts = String(client_name).trim().split(/\s+/);
  const firstName = nameParts.length > 1 ? nameParts.slice(0,-1).join(" ") : "Patient";
  const lastName = nameParts[nameParts.length-1];

  // Find default practitioner (first active staff member)
  const staffRes = await pg("/clinic_staff?is_active=eq.true&order=created_at.asc&limit=1&select=id");
  const staffRows = await staffRes.json();
  if (!staffRows.length) return resp({error:"No active staff found"}, 503);
  const practitionerId = staffRows[0].id;

  // Upsert clinic_patient by phone
  let patientId;
  const ptRes = await pg("/clinic_patients?phone=eq."+encodeURIComponent(String(client_phone))+"&select=id&limit=1");
  const ptRows = await ptRes.json();
  if (ptRows.length > 0) {
    patientId = ptRows[0].id;
    const patch = {first_name:firstName, last_name:lastName, updated_at:new Date().toISOString()};
    if (client_email) patch.email = String(client_email);
    await pg("/clinic_patients?id=eq."+patientId, {method:"PATCH", headers:{...DH,Prefer:"return=minimal"}, body:JSON.stringify(patch)});
  } else {
    const ins = {first_name:firstName, last_name:lastName, phone:String(client_phone), is_active:true};
    if (client_email) ins.email = String(client_email);
    const nr = await pg("/clinic_patients", {method:"POST", headers:{...DH,Prefer:"return=representation"}, body:JSON.stringify(ins)});
    if (!nr.ok) return resp({error:"Patient insert failed", detail:await nr.text()}, 500);
    const nData = await nr.json();
    patientId = nData[0].id;
  }

  // Google Calendar: check availability + create event
  let googleEventId = null;
  const GID = Deno.env.get("GOOGLE_CLIENT_ID")??"", GSEC = Deno.env.get("GOOGLE_SECRET")??"";
  const GREF = Deno.env.get("GOOGLE_REFRESH_TOKEN")??"", GCAL = Deno.env.get("GOOGLE_CALENDAR_ID")??"";
  if (GID && GSEC && GREF && GCAL) {
    try {
      const tr = await fetch("https://oauth2.googleapis.com/token", {method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:new URLSearchParams({client_id:GID,client_secret:GSEC,refresh_token:GREF,grant_type:"refresh_token"})});
      if (tr.ok) {
        const {access_token:at} = await tr.json();
        const fbR = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {method:"POST", headers:{Authorization:"Bearer "+at,"Content-Type":"application/json"}, body:JSON.stringify({timeMin:apptDate.toISOString(),timeMax:endDate.toISOString(),items:[{id:GCAL}]})});
        if (fbR.ok) {
          const fb = await fbR.json();
          if ((fb.calendars?.[GCAL]?.busy??[]).length > 0) return resp({error:"Time slot not available"}, 409);
        }
        const evR = await fetch("https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(GCAL)+"/events", {
          method:"POST", headers:{Authorization:"Bearer "+at,"Content-Type":"application/json"},
          body:JSON.stringify({summary:"RDV - "+String(client_name), description:notes??"", start:{dateTime:apptDate.toISOString(),timeZone:"America/Toronto"}, end:{dateTime:endDate.toISOString(),timeZone:"America/Toronto"}, attendees:client_email?[{email:String(client_email)}]:[]})
        });
        if (evR.ok) googleEventId = (await evR.json()).id;
      }
    } catch(e) { console.error("GCal error:", e.message); }
  }

  // Insert clinic_appointment
  const apptObj = {
    patient_id: patientId,
    practitioner_id: practitionerId,
    start_time: apptDate.toISOString(),
    end_time: endDate.toISOString(),
    type: "consultation",
    status: "scheduled",
    google_event_id: googleEventId
  };
  if (notes) apptObj.reason = String(notes);

  const insR = await pg("/clinic_appointments", {method:"POST", headers:{...DH,Prefer:"return=representation"}, body:JSON.stringify(apptObj)});
  if (!insR.ok) {
    // Rollback GCal event on DB failure
    if (googleEventId && GID && GSEC && GREF) {
      fetch("https://oauth2.googleapis.com/token", {method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:new URLSearchParams({client_id:GID,client_secret:GSEC,refresh_token:GREF,grant_type:"refresh_token"})}).then(tr => {
        if (tr.ok) tr.json().then(({access_token:at}) => {
          fetch("https://www.googleapis.com/calendar/v3/calendars/"+encodeURIComponent(GCAL)+"/events/"+googleEventId, {method:"DELETE", headers:{Authorization:"Bearer "+at}}).catch(()=>{});
        });
      }).catch(()=>{});
    }
    return resp({error:"DB insert failed", detail:await insR.text()}, 500);
  }
  const [appt] = await insR.json();

  // Async Twilio SMS confirmation
  const TSID=Deno.env.get("TWILIO_SID")??"", TTOK=Deno.env.get("TWILIO_TOKEN")??"", TPHONE=Deno.env.get("TWILIO_PHONE")??"";
  if (TSID && TTOK && TPHONE) {
    (async () => {
      const dtStr = apptDate.toLocaleString("fr-CA",{timeZone:"America/Toronto",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"});
      const msg = "Bonjour "+firstName+" "+lastName+", RDV confirme le "+dtStr+". Pour annuler: ANNULER. - Cinique";
      let smsSent = false;
      for (let i=0;i<3;i++) {
        try {
          const r = await fetch("https://api.twilio.com/2010-04-01/Accounts/"+TSID+"/Messages.json", {method:"POST", headers:{Authorization:"Basic "+btoa(TSID+":"+TTOK),"Content-Type":"application/x-www-form-urlencoded"}, body:new URLSearchParams({To:String(client_phone),From:TPHONE,Body:msg})});
          if (r.ok) { smsSent = true; break; }
          const errBody = await r.json().catch(()=>({}));
          console.error("Twilio SMS error attempt "+(i+1)+":", errBody.code, errBody.message);
          if (errBody.code === 21211 || errBody.code === 21614) break; // Invalid number — no point retrying
          await new Promise(r=>setTimeout(r,500*(2**i)));
        } catch(e) {
          console.error("Twilio SMS exception attempt "+(i+1)+":", e.message);
          await new Promise(r=>setTimeout(r,500*(2**i)));
        }
      }
      if (!smsSent) {
        await pg("/logs", {method:"POST", body:JSON.stringify({event_type:"sms_send_failed",severity:"warn",payload:{to:String(client_phone),appointment_id:appt.id},function_name:"create_appointment"})});
      }
    })();
  }

  // Log
  await pg("/logs", {method:"POST", body:JSON.stringify({event_type:"appointment_created",severity:"info",payload:{appointment_id:appt.id,patient_id:patientId,google_event_id:googleEventId},function_name:"create_appointment",ip_address:IP})});

  return resp({appointment_id:appt.id, status:appt.status, patient_id:patientId, google_event_id:googleEventId, start_time:apptDate.toISOString(), end_time:endDate.toISOString()}, 201);
};
