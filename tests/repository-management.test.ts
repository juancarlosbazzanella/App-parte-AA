import { expect, it } from "vitest";
import { climagestRepository as repository } from "@/lib/climagest";
import type { ManagedMember } from "@/lib/climagest";
import { appState } from "./helpers/fixtures";
import { query, supabaseMock as db } from "./helpers/supabase";

it.each([false, true])("persists a client with tenant scoping (existing=%s)", async (existing) => {
  const builder = query(null);
  db.from.mockReturnValue(builder);
  const client = { ...appState().clients[0], phone: "   " };
  await repository.saveClient(client, "org-a", "office-a", existing);
  expect(db.from).toHaveBeenCalledExactlyOnceWith("clients");
  if (existing) {
    expect(builder.update).toHaveBeenCalledExactlyOnceWith({ name: client.name, email: client.email, phone: null });
    expect(builder.eq.mock.calls).toEqual([["id", "client-a"], ["organization_id", "org-a"]]);
    expect(builder.insert).not.toHaveBeenCalled();
  } else {
    expect(builder.insert).toHaveBeenCalledExactlyOnceWith({ id: "client-a", name: client.name, email: client.email, phone: null, organization_id: "org-a", created_by_user_id: "office-a" });
    expect(builder.update).not.toHaveBeenCalled();
  }
});

it.each([false, true])("persists a machine with its client, serial and tenant (existing=%s)", async (existing) => {
  const builder = query(null);
  db.from.mockReturnValue(builder);
  await repository.saveMachine(appState().machines[0], "org-a", "office-a", existing);
  expect(db.from).toHaveBeenCalledExactlyOnceWith("machines");
  const fields = { client_id: "client-a", brand: "Daikin", model: "TX35", serial_number: "SER-001", installation_address: "Calle del Olmo 15" };
  if (existing) {
    expect(builder.update).toHaveBeenCalledExactlyOnceWith(fields);
    expect(builder.eq.mock.calls).toEqual([["id", "machine-a"], ["organization_id", "org-a"]]);
  } else {
    expect(builder.insert).toHaveBeenCalledExactlyOnceWith({ ...fields, id: "machine-a", organization_id: "org-a", created_by_user_id: "office-a" });
  }
});

it("propagates RLS failures when saving clients and machines", async () => {
  db.from.mockReturnValue(query(null, { message: "private detail" }));
  await expect(repository.saveClient(appState().clients[0], "org-a", "office-a", false)).rejects.toThrow("No se pudo crear el cliente.");
  await expect(repository.saveMachine(appState().machines[0], "org-a", "office-a", true)).rejects.toThrow("No se pudo actualizar la máquina.");
});

it("normalizes invitations and sends them only through the authorized Edge Function", async () => {
  db.functions.invoke.mockResolvedValue({ data: { success: true }, error: null });
  await repository.inviteMember("org-a", " tech@example.test ", " Técnica de pruebas ", "technician");
  expect(db.functions.invoke).toHaveBeenCalledExactlyOnceWith("climagest-invite", { body: { organizationId: "org-a", email: "tech@example.test", name: "Técnica de pruebas", role: "technician" } });
});

it("hides unexpected invitation failures and shows deliberate public messages", async () => {
  db.functions.invoke.mockResolvedValueOnce({ data: null, error: { message: "private detail" } });
  await expect(repository.inviteMember("org-a", "tech@example.test", "Fixture", "technician")).rejects.toThrow("No se pudo enviar la invitación.");
  db.functions.invoke.mockResolvedValueOnce({ data: null, error: { context: Response.json({ error: "Solo los administradores pueden invitar." }, { status: 403 }) } });
  await expect(repository.inviteMember("org-a", "tech@example.test", "Fixture", "technician")).rejects.toThrow("Solo los administradores pueden invitar.");
});

it.each([
  ["Debe quedar al menos un administrador activo.", "Debe quedar al menos un administrador activo."],
  ["Reasigna primero los partes abiertos de este técnico.", "Reasigna primero los partes abiertos de este técnico."],
  ["private detail", "No se pudo cambiar el acceso del usuario."],
])("reports safe membership errors: %s", async (serverMessage, publicMessage) => {
  db.rpc.mockResolvedValueOnce({ data: null, error: { message: serverMessage } });
  const member = { user_id: "tech-a" } as ManagedMember;
  await expect(repository.updateMember("org-a", member, "office", false)).rejects.toThrow(publicMessage);
  expect(db.rpc).toHaveBeenCalledExactlyOnceWith("update_organization_member", { p_organization_id: "org-a", p_user_id: "tech-a", p_role: "office", p_is_active: false });
});
