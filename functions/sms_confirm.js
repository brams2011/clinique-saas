module.exports = async function(req) {
  if (req.method !== "POST") return new Response("", {status:405});
  const JWT_SECRET = Deno.env.get("JWT_SECRET") ?? "";
  const TSID  = Deno.env.get("TWILIO_SID")   ?? "";
  const TTOK  = Deno.env.get("TWILIO_TOKEN")  ?? "";
  const TPHONE = Deno.env.get("TWILIO_PHONE") ?? "";

  function resp(body, status=200) {
    return new Response(JSON.stringify(body), {status, headers:{"Content-Type":"application/json"}});
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

  const token = (req.headers.get("Authorization")??"").replace("Bearer ","").trim();
  if (!await verifyJWT(token)) return resp({error:"Unauthorized"}, 401);

  let body; try { body = await req.json(); } catch { return resp({error:"Invalid JSON"}, 400); }
  const { patient_name, patient_phone, start_time } = body;

  if (!patient_phone || !start_time) return resp({error:"patient_phone and start_time required"}, 422);
  if (!/^\+?[1-9]\d{7,14}$/.test(String(patient_phone))) return resp({error:"Invalid phone format"}, 422);

  if (!TSID || !TTOK || !TPHONE) return resp({error:"Twilio not configured"}, 503);

  const apptDate = new Date(start_time);
  const dtStr = apptDate.toLocaleString("fr-CA",{timeZone:"America/Toronto",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"});
  const name = String(patient_name || "").trim() || "Patient";
  const msg = "Bonjour "+name+", votre RDV est confirme le "+dtStr+". Pour annuler repondez ANNULER. - Cinique";

  try {
    const r = await fetch("https://api.twilio.com/2010-04-01/Accounts/"+TSID+"/Messages.json", {
      method:"POST",
      headers:{Authorization:"Basic "+btoa(TSID+":"+TTOK),"Content-Type":"application/x-www-form-urlencoded"},
      body:new URLSearchParams({To:String(patient_phone),From:TPHONE,Body:msg})
    });
    if (r.ok) return resp({sent:true});
    const err = await r.json().catch(()=>({}));
    console.error("sms_confirm Twilio error:", err.code, err.message);
    return resp({sent:false, error:err.message, code:err.code}, 200);
  } catch(e) {
    console.error("sms_confirm exception:", e.message);
    return resp({sent:false, error:e.message}, 200);
  }
};
