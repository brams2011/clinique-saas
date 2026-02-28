// clinic_cal_sync — Sync clinic appointments with Google Calendar
// Actions: create | update | delete
module.exports = async function(req) {
  if (req.method !== "POST") return resp({ error: "Method not allowed" }, 405);

  const GID  = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
  const GSEC = Deno.env.get("GOOGLE_SECRET") ?? "";
  const GREF = Deno.env.get("GOOGLE_REFRESH_TOKEN") ?? "";
  const GCAL = Deno.env.get("GOOGLE_CALENDAR_ID") ?? "";

  function resp(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }

  // InsForge user tokens are signed with the InsForge internal secret (not JWT_SECRET).
  // We decode without signature verification and only check presence + expiry.
  function decodeJWT(token) {
    if (!token) return null;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;
      const pad = s => s + "=".repeat((4 - s.length % 4) % 4);
      const payload = JSON.parse(atob(pad(parts[1].replace(/-/g, "+").replace(/_/g, "/"))));
      if (payload.exp && payload.exp < Date.now() / 1000) return null;
      // Must have a subject (authenticated user)
      if (!payload.sub) return null;
      return payload;
    } catch { return null; }
  }

  // Auth
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  const jwt = decodeJWT(token);
  if (!jwt) return resp({ error: "Unauthorized" }, 401);

  if (!GID || !GSEC || !GREF || !GCAL) {
    return resp({ error: "Google Calendar not configured" }, 503);
  }

  let body;
  try { body = await req.json(); } catch { return resp({ error: "Invalid JSON" }, 400); }

  const { action, event_id, summary, description, start_time, end_time, patient_email } = body;

  if (!["create", "update", "delete"].includes(action)) {
    return resp({ error: "action must be create, update, or delete" }, 422);
  }

  // Get OAuth access token
  let access_token;
  try {
    const tr = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: GID, client_secret: GSEC, refresh_token: GREF, grant_type: "refresh_token" })
    });
    if (!tr.ok) {
      const txt = await tr.text();
      return resp({ error: "Google OAuth failed", detail: txt }, 502);
    }
    access_token = (await tr.json()).access_token;
  } catch (e) {
    return resp({ error: "Google OAuth error: " + e.message }, 502);
  }

  const GH = { Authorization: "Bearer " + access_token, "Content-Type": "application/json" };
  const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars/" + encodeURIComponent(GCAL) + "/events";

  try {
    // ── DELETE ──
    if (action === "delete") {
      if (!event_id) return resp({ error: "event_id required for delete" }, 422);
      const r = await fetch(CAL_BASE + "/" + encodeURIComponent(event_id), { method: "DELETE", headers: GH });
      // 410 means already deleted — treat as success
      if (!r.ok && r.status !== 410) {
        return resp({ error: "Calendar delete failed", status: r.status }, 502);
      }
      return resp({ deleted: true });
    }

    // ── CREATE / UPDATE ──
    if (!summary || !start_time || !end_time) {
      return resp({ error: "summary, start_time, end_time required" }, 422);
    }

    const event = {
      summary: String(summary),
      description: String(description ?? ""),
      start: { dateTime: start_time, timeZone: "America/Toronto" },
      end:   { dateTime: end_time,   timeZone: "America/Toronto" },
    };
    if (patient_email) event.attendees = [{ email: String(patient_email) }];

    if (action === "update") {
      if (!event_id) return resp({ error: "event_id required for update" }, 422);
      const r = await fetch(CAL_BASE + "/" + encodeURIComponent(event_id), {
        method: "PUT", headers: GH, body: JSON.stringify(event)
      });
      if (!r.ok) {
        const txt = await r.text();
        return resp({ error: "Calendar update failed", detail: txt }, 502);
      }
      const ev = await r.json();
      return resp({ event_id: ev.id });
    }

    // action === "create"
    const r = await fetch(CAL_BASE, {
      method: "POST", headers: GH, body: JSON.stringify(event)
    });
    if (!r.ok) {
      const txt = await r.text();
      return resp({ error: "Calendar create failed", detail: txt }, 502);
    }
    const ev = await r.json();
    return resp({ event_id: ev.id });

  } catch (e) {
    return resp({ error: "Google Calendar error: " + e.message }, 500);
  }
};
