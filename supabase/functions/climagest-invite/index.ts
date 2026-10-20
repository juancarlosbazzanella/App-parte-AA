import { createClient } from "@supabase/supabase-js";

// Only these application origins may receive account-activation links.
const allowedOrigins = new Set([
  "https://partes.juancarlosbazzanella.es", "http://localhost:5173", "http://127.0.0.1:5173",
]);
const additionalOrigin = Deno.env.get("CLIMAGEST_APP_ORIGIN");
if (additionalOrigin) allowedOrigins.add(new URL(additionalOrigin).origin);

Deno.serve(async (request: Request) => {
  const origin = request.headers.get("Origin") ?? "";
  const headers = {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://partes.juancarlosbazzanella.es",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
  const respond = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
  if (!allowedOrigins.has(origin)) return respond(403, { error: "Origen no autorizado." });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return respond(405, { error: "Método no permitido." });
  const authorization = request.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return respond(401, { error: "Inicia sesión para continuar." });

  // Never return the server credential or any raw provider/database error.
  const url = Deno.env.get("SUPABASE_URL")!;
  const serverKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const caller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await caller.auth.getUser(authorization.slice(7));
  if (userError || !user) return respond(401, { error: "La sesión ha caducado. Vuelve a entrar." });
  try {
    if (Number(request.headers.get("Content-Length") ?? 0) > 4096) return respond(413, { error: "La solicitud es demasiado grande." });
    const input = await request.json();
    const { organizationId, email, name, role } = input;
    if (typeof organizationId !== "string" || !/^[0-9a-f-]{36}$/i.test(organizationId)
      || typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      || typeof name !== "string" || !name.trim() || name.length > 120
      || !["admin", "office", "technician"].includes(role)) return respond(400, { error: "Revisa el nombre, el correo y el rol." });

    // This RPC checks the current live membership and rate limits inside the DB.
    const { data: invitationId, error: preparationError } = await caller.rpc("prepare_member_invitation", {
      p_organization_id: organizationId, p_email: email, p_full_name: name, p_role: role,
    });
    if (preparationError || !invitationId) {
      const messages = ["Esta cuenta ya pertenece a la empresa. Gestiona su acceso en Usuarios.", "Espera un minuto antes de volver a invitar este correo.", "Se ha alcanzado el límite de invitaciones. Inténtalo más tarde."];
      return respond(preparationError?.code === "42501" ? 403 : 400, { error: messages.includes(preparationError?.message ?? "") ? preparationError!.message : "No tienes permiso para enviar esta invitación." });
    }
    const admin = createClient(url, serverKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.trim().toLowerCase(), {
      data: { full_name: name.trim() }, redirectTo: `${origin}/?auth=setup`,
    });
    if (inviteError || !invited.user) {
      await admin.from("member_invitations").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", invitationId);
      return respond(400, { error: "No se pudo enviar el correo. Comprueba la dirección y la configuración SMTP de Supabase; la cuenta también podría estar ya registrada." });
    }
    const { error: completionError } = await admin.rpc("complete_member_invitation", { p_invitation_id: invitationId, p_user_id: invited.user.id });
    if (completionError) {
      await admin.from("member_invitations").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", invitationId);
      return respond(409, { error: "La invitación no pudo autorizarse. El usuario no tiene acceso; vuelve a intentarlo desde una cuenta de administrador." });
    }
    return respond(200, { success: true });
  } catch {
    return respond(400, { error: "No se pudo completar la invitación. Revisa los datos e inténtalo de nuevo." });
  }
});
