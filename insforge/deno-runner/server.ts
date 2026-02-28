// InsForge — Deno function runner
// Charge dynamiquement les fonctions depuis /functions/*.js (CommonJS)

const FUNCTIONS_DIR = Deno.env.get("FUNCTIONS_DIR") ?? "/functions";
const PORT = parseInt(Deno.env.get("DENO_PORT") ?? "7133");

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type,X-ElevenLabs-Signature",
};

// ─── Chargement des fonctions (CJS via eval) ───────────────────────────────

type Handler = (req: Request) => Promise<Response>;
const handlers = new Map<string, Handler>();

async function loadFunctions() {
  try {
    for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
      if (!entry.isFile || !entry.name.endsWith(".js")) continue;
      const name = entry.name.replace(".js", "");
      try {
        const code = await Deno.readTextFile(`${FUNCTIONS_DIR}/${entry.name}`);
        // Wrap CJS module.exports
        const handler = eval(
          `(function(){ const module={exports:{}};\n${code}\n;return module.exports; })()`
        ) as Handler;
        if (typeof handler === "function") {
          handlers.set(name, handler);
          console.log(`✅ Loaded: ${name}`);
        } else {
          console.warn(`⚠️  ${name}: export n'est pas une fonction`);
        }
      } catch (e) {
        console.error(`❌ Failed to load ${name}:`, (e as Error).message);
      }
    }
    console.log(`\n🚀 ${handlers.size} fonction(s) disponible(s) sur le port ${PORT}\n`);
  } catch (e) {
    console.error("Impossible de lire le dossier functions:", (e as Error).message);
  }
}

await loadFunctions();

// ─── Serveur HTTP ──────────────────────────────────────────────────────────

Deno.serve({ port: PORT, hostname: "0.0.0.0" }, async (req: Request): Promise<Response> => {
  // Preflight CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  const url      = new URL(req.url);
  const funcName = url.pathname.split("/").filter(Boolean)[0] ?? "";

  const handler = handlers.get(funcName);
  if (!handler) {
    return new Response(
      JSON.stringify({ error: `Function '${funcName}' not found` }),
      { status: 404, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }

  try {
    const response = await handler(req);
    const newHeaders = new Headers(response.headers);
    for (const [k, v] of Object.entries(CORS)) newHeaders.set(k, v);
    return new Response(response.body, { status: response.status, headers: newHeaders });
  } catch (e) {
    console.error(`Error in ${funcName}:`, e);
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json", ...CORS } }
    );
  }
});
