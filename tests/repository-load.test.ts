import { beforeEach, expect, it } from "vitest";
import { climagestRepository as repository } from "@/lib/climagest";
import { query, storageMock, supabaseMock as db } from "./helpers/supabase";
import { workOrderRow } from "./helpers/fixtures";

function loadTables() {
  const tables = {
    organizations: query({ id: "org-a", name: "Empresa de pruebas" }),
    organization_members: query([{ organization_id: "org-a", user_id: "tech-a", role: "technician", is_active: true }, { organization_id: "org-a", user_id: "office-a", role: "office", is_active: true }]),
    profiles: query([{ id: "tech-a", full_name: "Técnica de pruebas" }]),
    clients: query([{ id: "client-a", name: "Clínica Álamo", email: "client@example.test", phone: null }]),
    machines: query([{ id: "machine-a", client_id: "client-a", brand: "Daikin", model: "TX35", serial_number: "SER-001", installation_address: "Calle del Olmo 15" }]),
    work_orders: query([workOrderRow(), workOrderRow({ id: "job-b", reference: "PT2-1002", type: "breakdown", hours: 0, scheduled_time: null })]),
    work_order_photos: query([]),
    work_order_corrections: query([]),
  };
  db.from.mockImplementation((name) => {
    if (!(name in tables)) throw new Error(`Unexpected table: ${name}`);
    return tables[name as keyof typeof tables];
  });
  return tables;
}

beforeEach(() => {
  db.auth.getUser.mockResolvedValue({ data: { user: { id: "tech-a", email: "tech@example.test" } }, error: null });
});

it("maps persisted fields, nulls, hours and roles into the application state", async () => {
  const tables = loadTables();
  const state = await repository.load();
  expect(state).toMatchObject({ organizationId: "org-a", organization: { name: "Empresa de pruebas" } });
  expect(state.users).toEqual([
    { id: "tech-a", name: "Técnica de pruebas", email: "tech@example.test", role: "technician", isActive: true },
    { id: "office-a", name: "Usuario", email: "", role: "office", isActive: true },
  ]);
  expect(state.clients[0].phone).toBe("");
  expect(state.machines[0]).toMatchObject({ clientId: "client-a", serial: "SER-001", address: "Calle del Olmo 15" });
  expect(state.jobs[0]).toMatchObject({ number: "PT-1001", type: "Mantenimiento", scheduledTime: "09:30", hours: "", workDone: "", signerName: "", photos: [], corrections: [], version: 4 });
  expect(state.jobs[1]).toMatchObject({ number: "PT2-1002", type: "Avería", hours: "0", scheduledTime: "" });
  expect(tables.organization_members.eq).toHaveBeenCalledWith("user_id", "tech-a");
  expect(tables.organization_members.eq).toHaveBeenCalledWith("is_active", true);
  for (const name of ["clients", "machines", "work_orders", "work_order_photos", "work_order_corrections"] as const) {
    expect(tables[name].eq).toHaveBeenCalledWith("organization_id", "org-a");
  }
  expect(tables.clients.is).toHaveBeenCalledWith("archived_at", null);
  expect(tables.machines.is).toHaveBeenCalledWith("archived_at", null);
  expect(storageMock.createSignedUrls).not.toHaveBeenCalled();
});

it("groups photos and corrections by part and signs each private path only once", async () => {
  const tables = loadTables();
  tables.work_orders = query([workOrderRow({ signature_storage_path: "org-a/job-a/signature.png" }), workOrderRow({ id: "job-b" })]);
  tables.work_order_photos = query([
    { id: "photo-a", work_order_id: "job-a", original_filename: "equipo.png", storage_path: "org-a/job-a/photo.png", mime_type: "image/png", size_bytes: 7 },
    { id: "photo-b", work_order_id: "job-b", original_filename: "otro.png", storage_path: "org-a/job-a/photo.png", mime_type: "image/png", size_bytes: 7 },
  ]);
  tables.work_order_corrections = query([{ id: "correction-b", work_order_id: "job-b", created_at: "2026-10-20T09:00:00Z", corrected_by_user_id: "office-a", summary: "Corregir horas" }]);
  storageMock.createSignedUrls.mockResolvedValue({ data: [
    { path: "org-a/job-a/photo.png", signedUrl: "https://files.example.test/photo" },
    { path: "org-a/job-a/signature.png", signedUrl: "https://files.example.test/signature" },
  ], error: null });
  const state = await repository.load();
  expect(storageMock.createSignedUrls).toHaveBeenCalledExactlyOnceWith(["org-a/job-a/photo.png", "org-a/job-a/signature.png"], 120);
  expect(state.jobs[0].photos).toEqual([{ id: "photo-a", name: "equipo.png", dataUrl: "https://files.example.test/photo", storagePath: "org-a/job-a/photo.png", mimeType: "image/png", sizeBytes: 7 }]);
  expect(state.jobs[0].signatureDataUrl).toBe("https://files.example.test/signature");
  expect(state.jobs[0].corrections).toEqual([]);
  expect(state.jobs[1].photos.map((photo) => photo.id)).toEqual(["photo-b"]);
  expect(state.jobs[1].corrections).toEqual([{ id: "correction-b", at: "2026-10-20T09:00:00Z", byUserId: "office-a", summary: "Corregir horas" }]);
});

it("rejects missing sessions and memberships before loading company data", async () => {
  db.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
  await expect(repository.load()).rejects.toThrow("La sesión ha caducado.");
  expect(db.from).not.toHaveBeenCalled();
  db.from.mockReturnValue(query([]));
  await expect(repository.load()).rejects.toThrow("Tu cuenta no pertenece a ninguna empresa activa.");
  expect(db.from).toHaveBeenCalledExactlyOnceWith("organization_members");
});

it.each(["organizations", "organization_members", "profiles", "clients", "machines", "work_orders", "work_order_photos", "work_order_corrections"])("does not return partial data after a %s query fails", async (table) => {
  const tables = loadTables();
  tables[table as keyof typeof tables] = query(null, { message: "private detail" });
  await expect(repository.load()).rejects.toThrow(table === "organization_members" ? "No se pudo cargar la pertenencia" : "No se pudieron cargar los datos");
});

it("renews a private URL for two minutes and reports access failures safely", async () => {
  storageMock.createSignedUrl.mockResolvedValueOnce({ data: { signedUrl: "https://files.example.test/new" }, error: null });
  await expect(repository.getPrivateFileUrl("org-a/job-a/photo.png")).resolves.toBe("https://files.example.test/new");
  expect(storageMock.createSignedUrl).toHaveBeenCalledExactlyOnceWith("org-a/job-a/photo.png", 120);
  storageMock.createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: "private detail" } });
  await expect(repository.getPrivateFileUrl("org-a/job-a/photo.png")).rejects.toThrow("No se pudo abrir el archivo privado.");
});
