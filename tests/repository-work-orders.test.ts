import { beforeEach, describe, expect, it, vi } from "vitest";
import { climagestRepository as repository } from "@/lib/climagest";
import { query, storageMock, supabaseMock as db } from "./helpers/supabase";
import { technician, workOrder, workOrderRow } from "./helpers/fixtures";

beforeEach(() => {
  db.from.mockReturnValue(query([]));
  db.rpc.mockResolvedValue({ data: workOrderRow(), error: null });
});

describe("work-order persistence", () => {
  it.each([
    ["Instalación", "installation"], ["Mantenimiento", "maintenance"],
    ["Avería", "breakdown"], ["Revisión", "inspection"],
  ] as const)("creates %s using server numbering and normalized values", async (type, databaseType) => {
    await expect(repository.saveWorkOrder(workOrder({ id: "", type, source: "urgent", request: "  Revisar  ", workDone: "  ", hours: "1.5", scheduledTime: "" }), technician)).resolves.toEqual({ id: "job-a", reference: "PT-1001" });
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("create_work_order", expect.objectContaining({
      p_organization_id: "org-a", p_client_id: "client-a", p_machine_id: "machine-a",
      p_technician_user_id: "tech-a", p_type: databaseType, p_source: "urgent",
      p_request: "Revisar", p_work_done: null, p_hours: 1.5, p_scheduled_time: null,
    }));
  });

  it("sends the expected version when updating an open part", async () => {
    await repository.saveWorkOrder(workOrder({ hours: "0" }), technician);
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("update_open_work_order", expect.objectContaining({ p_work_order_id: "job-a", p_expected_version: 3, p_hours: 0 }));
  });

  it("stops on a concurrency conflict before modifying files or closing", async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: { message: "Version conflict" } });
    await expect(repository.saveWorkOrder(workOrder(), technician, true)).rejects.toThrow("No se pudo actualizar el parte.");
    expect(db.from).not.toHaveBeenCalled();
    expect(storageMock.upload).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });

  it("requires a returned row instead of reporting a save that did not happen", async () => {
    db.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(repository.saveWorkOrder(workOrder({ id: "" }), technician)).rejects.toThrow("Supabase no devolvió el parte creado.");
  });

  it("routes a closed correction through the audited RPC without changing its signature", async () => {
    await repository.saveWorkOrder(workOrder({ status: "closed", correctionSummary: "  Corregir horas  ", signatureStoragePath: "original/signature.png" }), technician);
    expect(db.rpc).toHaveBeenCalledExactlyOnceWith("correct_closed_work_order", expect.objectContaining({ p_expected_version: 3, p_summary: "Corregir horas" }));
    expect(db.rpc.mock.calls[0][1]).not.toHaveProperty("p_signature_storage_path");
    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it("closes without a signature using the version returned by the save", async () => {
    await repository.saveWorkOrder(workOrder({ status: "closed", workDone: "Filtros limpios", noSignatureReason: "  Cliente ausente  " }), technician, true);
    expect(db.rpc.mock.calls.map(([name]) => name)).toEqual(["update_open_work_order", "close_work_order"]);
    expect(db.rpc).toHaveBeenLastCalledWith("close_work_order", expect.objectContaining({ p_expected_version: 4, p_signer_name: null, p_signature_storage_path: null, p_no_signature_reason: "Cliente ausente" }));
    expect(storageMock.upload).not.toHaveBeenCalled();
  });

  it("can create and close an urgent part using the server-created ID", async () => {
    db.rpc.mockResolvedValueOnce({ data: workOrderRow({ id: "server-created", version: 1 }), error: null });
    await repository.saveWorkOrder(workOrder({ id: "", source: "urgent", noSignatureReason: "Cliente ausente" }), technician, true);
    expect(db.rpc).toHaveBeenLastCalledWith("close_work_order", expect.objectContaining({ p_work_order_id: "server-created", p_expected_version: 1 }));
  });
});

describe("private photos and signatures", () => {
  const photo = { id: "photo-new", name: "equipo.png", dataUrl: "data:image/png;base64,Zml4dHVyZQ==" };

  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, blob: async () => new Blob(["fixture"], { type: "image/png" }) } as Response);
  });

  it("uploads photos before closure and records their tenant, author and order", async () => {
    await repository.saveWorkOrder(workOrder({ photos: [photo], noSignatureReason: "Ausente" }), technician, true);
    expect(storageMock.upload).toHaveBeenCalledExactlyOnceWith("org-a/job-a/photos/photo-new.png", expect.any(Blob), { contentType: "image/png", upsert: false });
    const insertion = db.from.mock.results.map((result) => result.value).find((builder) => builder.insert.mock.calls.length);
    expect(insertion?.insert).toHaveBeenCalledWith(expect.objectContaining({ organization_id: "org-a", work_order_id: "job-a", uploaded_by_user_id: "tech-a", sort_order: 0, mime_type: "image/png", size_bytes: 7 }));
    expect(storageMock.upload.mock.invocationCallOrder[0]).toBeLessThan(db.rpc.mock.invocationCallOrder[1]);
  });

  it("retains stored photos and removes only discarded files and rows", async () => {
    const builder = query([{ id: "keep", storage_path: "org-a/job-a/keep.png" }, { id: "remove", storage_path: "org-a/job-a/remove.png" }]);
    db.from.mockReturnValue(builder);
    await repository.saveWorkOrder(workOrder({ photos: [{ id: "keep", name: "stored.png", dataUrl: "https://files.example.test/signed", storagePath: "org-a/job-a/keep.png" }] }), technician);
    expect(storageMock.remove).toHaveBeenCalledExactlyOnceWith(["org-a/job-a/remove.png"]);
    expect(builder.in).toHaveBeenCalledWith("id", ["remove"]);
    expect(storageMock.upload).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("removes an uploaded photo if its metadata fails to save", async () => {
    db.from.mockReturnValueOnce(query([])).mockReturnValueOnce(query(null, { message: "private detail" }));
    await expect(repository.saveWorkOrder(workOrder({ photos: [photo] }), technician, true)).rejects.toThrow("No se pudo guardar la fotografía.");
    expect(storageMock.remove).toHaveBeenCalledExactlyOnceWith(["org-a/job-a/photos/photo-new.png"]);
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });

  it("does not close when an upload fails", async () => {
    storageMock.upload.mockResolvedValueOnce({ error: { message: "Upload failed" } });
    await expect(repository.saveWorkOrder(workOrder({ photos: [photo] }), technician, true)).rejects.toThrow("No se pudo subir equipo.png.");
    expect(db.rpc).toHaveBeenCalledTimes(1);
  });

  it("uploads a signature to its own part before calling the close RPC", async () => {
    await repository.saveWorkOrder(workOrder({ signatureDataUrl: photo.dataUrl, signerName: "  Persona de prueba  " }), technician, true);
    const path = storageMock.upload.mock.calls[0][0];
    expect(path).toMatch(/^org-a\/job-a\/signature\/.+\.png$/);
    expect(db.rpc).toHaveBeenLastCalledWith("close_work_order", expect.objectContaining({ p_signature_storage_path: path, p_signer_name: "Persona de prueba", p_no_signature_reason: null }));
  });

  it.each([false, true])("cleans up only a new signature when closing fails (existing=%s)", async (existing) => {
    db.rpc.mockResolvedValueOnce({ data: workOrderRow(), error: null }).mockResolvedValueOnce({ data: null, error: { message: "Conflict" } });
    await expect(repository.saveWorkOrder(workOrder({ signatureDataUrl: photo.dataUrl, signatureStoragePath: existing ? "original/signature.png" : "" }), technician, true)).rejects.toThrow("No se pudo cerrar el parte.");
    if (existing) {
      expect(storageMock.remove).not.toHaveBeenCalled();
      expect(storageMock.upload).not.toHaveBeenCalled();
    } else {
      expect(storageMock.remove).toHaveBeenCalledExactlyOnceWith([storageMock.upload.mock.calls[0][0]]);
    }
  });
});
