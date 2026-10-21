// Offline router for the disposable recovery drill. The application function is
// restored unchanged and bundled from the pinned repository dependency graph.
/* global Deno, EdgeRuntime */
const secret = new TextEncoder().encode(Deno.env.get("JWT_SECRET"));
const key = await crypto.subtle.importKey("raw", secret, {name:"HMAC", hash:"SHA-256"}, false, ["verify"]);
function bytes(value) {
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
}
Deno.serve(async request => {
  const name = new URL(request.url).pathname.split("/").filter(Boolean)[0];
  if (name !== "climagest-invite") return new Response("Not found", {status:404});
  if (request.method !== "OPTIONS") {
    try {
      const parts = (request.headers.get("Authorization") ?? "").replace(/^Bearer /, "").split(".");
      const claims = JSON.parse(new TextDecoder().decode(bytes(parts[1])));
      const header = JSON.parse(new TextDecoder().decode(bytes(parts[0])));
      if (header.alg !== "HS256" || typeof claims.exp !== "number" || claims.exp <= Date.now()/1000 ||
          !await crypto.subtle.verify("HMAC", key, bytes(parts[2]), new TextEncoder().encode(parts[0]+"."+parts[1]))) throw new Error("Invalid JWT");
    } catch {
      return new Response("Unauthorized", {status:401});
    }
  }
  const worker = await EdgeRuntime.userWorkers.create({
    servicePath:"/home/deno/functions/climagest-invite", memoryLimitMb:150,
    workerTimeoutMs:60000, noModuleCache:false, envVars:Object.entries(Deno.env.toObject()),
  });
  return worker.fetch(request);
});
