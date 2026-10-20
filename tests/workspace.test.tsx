import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClimaGestApp } from "@/components/climagest-app";
import { climagestRepository as repository } from "@/lib/climagest";
import type { AppState, UserRole } from "@/lib/climagest";
import { appState, technician, workOrder } from "./helpers/fixtures";

let state: AppState;
let onChange: () => void;
let onAuthChange: Parameters<typeof repository.onAuthStateChange>[0];
const signedImage = "data:image/png;base64,Zml4dHVyZQ==";

beforeEach(() => {
  state = appState();
  vi.spyOn(repository, "load").mockImplementation(async () => structuredClone(state));
  vi.spyOn(repository, "initializeAuth").mockResolvedValue({ user: { id: technician.id } as Awaited<ReturnType<typeof repository.signIn>>, passwordSetup: false });
  vi.spyOn(repository, "onAuthStateChange").mockImplementation((callback) => { onAuthChange = callback; return vi.fn(); });
  vi.spyOn(repository, "subscribe").mockImplementation((callback) => { onChange = callback; return {} as ReturnType<typeof repository.subscribe>; });
  vi.spyOn(repository, "unsubscribe").mockResolvedValue();
  vi.spyOn(repository, "saveWorkOrder").mockResolvedValue({ id: "job-a", reference: "PT-1001" });
  vi.spyOn(repository, "listMembers").mockResolvedValue([]);
  vi.spyOn(repository, "listInvitations").mockResolvedValue([]);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    setTransform: vi.fn(), fillRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(),
    lineTo: vi.fn(), stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(signedImage);
});

async function openWorkspace(role: UserRole = "technician") {
  const id = role === "technician" ? technician.id : `${role}-a`;
  vi.mocked(repository.initializeAuth).mockResolvedValue({ user: { id } as Awaited<ReturnType<typeof repository.signIn>>, passwordSetup: false });
  render(<ClimaGestApp />);
  await screen.findByRole("button", { name: /PT-1001/ });
  return userEvent.setup();
}

async function openJobForm(role: UserRole = "technician") {
  const user = await openWorkspace(role);
  await user.click(screen.getByRole("button", { name: /PT-1001/ }));
  await user.click(screen.getByRole("button", { name: "Rellenar parte" }));
  return user;
}

async function openClosure() {
  const user = await openJobForm();
  await user.type(screen.getByPlaceholderText("Explica de forma clara qué se ha hecho"), "Filtros limpios");
  await user.click(screen.getByRole("button", { name: "Cerrar parte" }));
  return { user, dialog: within(screen.getByRole("dialog")) };
}

describe("roles and navigation", () => {
  it.each(["admin", "office", "technician"] as const)("shows the allowed navigation and parts for %s", async (role) => {
    await openWorkspace(role);
    expect(Boolean(screen.queryByRole("button", { name: "Clientes" }))).toBe(role !== "technician");
    expect(Boolean(screen.queryByRole("button", { name: "Usuarios" }))).toBe(role === "admin");
    expect(Boolean(screen.queryByRole("button", { name: /PT-1002/ }))).toBe(role !== "technician");
  });

  it("keeps user management without company settings or numbering controls", async () => {
    const user = await openWorkspace("admin");
    await user.click(screen.getByRole("button", { name: "Usuarios" }));
    await screen.findByRole("heading", { name: "Usuarios" });
    await waitFor(() => expect(screen.queryByText("Cargando equipo…")).toBeNull());
    expect(screen.getByRole("heading", { name: "Invitar a una persona" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Equipo" })).toBeTruthy();
    expect(screen.queryByText("Datos de la empresa")).toBeNull();
    expect(screen.queryByLabelText("Nombre de la empresa")).toBeNull();
    expect(screen.queryByLabelText("Prefijo de los nuevos partes")).toBeNull();
    expect(screen.queryByRole("button", { name: "Guardar empresa" })).toBeNull();
  });

  it("searches without case or accent sensitivity and restores the list", async () => {
    const user = await openWorkspace();
    const search = screen.getByPlaceholderText("Buscar por cliente, máquina, serie o dirección");
    for (const term of ["clinica alamo", "DAIKIN", "TX35", "SER-001", "olmo 15", "PT-1001"]) {
      await user.clear(search);
      await user.type(search, term);
      expect(screen.queryByRole("button", { name: /PT-1001/ })).not.toBeNull();
    }
    await user.clear(search);
    await user.type(search, "no existe");
    expect(screen.queryByRole("button", { name: /PT-1001/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Limpiar búsqueda" }));
    expect(screen.queryByRole("button", { name: /PT-1001/ })).not.toBeNull();
  });

  it("lets technicians read closed history from another technician without editing it", async () => {
    state.jobs.push(workOrder({ id: "historical", number: "PT-0999", technicianId: "tech-b", status: "closed", closedAt: "2026-10-19T10:00:00Z", noSignatureReason: "Ausente" }));
    const user = await openWorkspace();
    expect(screen.queryByRole("button", { name: /PT-0999/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: /PT-1001/ }));
    await user.click(screen.getByRole("button", { name: /historial/i }));
    expect(screen.queryByRole("button", { name: /PT-1002/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: /PT-0999/ }));
    expect(screen.queryByRole("button", { name: "Corregir parte" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rellenar parte" })).toBeNull();
  });
});

describe("work forms", () => {
  it.each(["office", "technician"] as const)("creates a part with the correct assignment and source for %s", async (role) => {
    const user = await openWorkspace(role);
    await user.click(screen.getAllByRole("button", { name: role === "office" ? "Nuevo trabajo" : "Abrir urgencia" })[0]);
    await user.click(screen.getByRole("button", { name: role === "office" ? "Crear trabajo" : "Guardar urgencia abierta" }));
    await waitFor(() => expect(repository.saveWorkOrder).toHaveBeenCalledTimes(1));
    expect(repository.saveWorkOrder).toHaveBeenCalledWith(expect.objectContaining({ id: "", status: "open", source: role === "office" ? "office" : "urgent", technicianId: "tech-a", clientId: "client-a", machineId: "machine-a" }), expect.objectContaining({ role }), false);
    expect(repository.load).toHaveBeenCalledTimes(2);
  });

  it("allows saving open without work done and preserves the draft after a failure", async () => {
    vi.mocked(repository.saveWorkOrder).mockRejectedValueOnce(new Error("No se pudo actualizar el parte.")).mockResolvedValueOnce({ id: "job-a", reference: "PT-1001" });
    const user = await openJobForm();
    const observations = screen.getByPlaceholderText("Recomendaciones, acceso, próxima revisión...");
    await user.type(observations, "Volver mañana");
    await user.click(screen.getByRole("button", { name: "Guardar abierto" }));
    expect((await screen.findByRole("alert")).textContent).toContain("No se pudo actualizar");
    expect((observations as HTMLTextAreaElement).value).toBe("Volver mañana");
    await user.click(screen.getByRole("button", { name: "Guardar abierto" }));
    await waitFor(() => expect(repository.saveWorkOrder).toHaveBeenCalledTimes(2));
    expect(repository.saveWorkOrder).toHaveBeenLastCalledWith(expect.objectContaining({ workDone: "", observations: "Volver mañana", version: 3 }), technician, false);
  });

  it("requires completed work before opening the closing dialog", async () => {
    const user = await openJobForm();
    await user.click(screen.getByRole("button", { name: "Cerrar parte" }));
    expect(screen.getByRole("alert").textContent).toContain("debes indicar qué trabajo se ha realizado");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(repository.saveWorkOrder).not.toHaveBeenCalled();
  });

  it("requires a reason for office corrections and preserves original closure data", async () => {
    state.jobs[0] = workOrder({ status: "closed", closedAt: "2026-10-19T12:00:00Z", noSignatureReason: "Cliente ausente" });
    const user = await openWorkspace("office");
    await user.click(screen.getByRole("button", { name: /PT-1001/ }));
    await user.click(screen.getByRole("button", { name: "Corregir parte" }));
    const reason = screen.getByPlaceholderText("Explica qué se corrige y por qué");
    await user.type(reason, "   ");
    await user.click(screen.getByRole("button", { name: "Guardar corrección" }));
    expect(screen.getByRole("alert").textContent).toContain("Explica el motivo de la corrección");
    expect(repository.saveWorkOrder).not.toHaveBeenCalled();
    expect((screen.getByLabelText(/Añadir fotos/) as HTMLInputElement).disabled || screen.getByLabelText(/Añadir fotos/).matches(":disabled")).toBe(true);
    await user.type(reason, "Corregir materiales");
    await user.click(screen.getByRole("button", { name: "Guardar corrección" }));
    await waitFor(() => expect(repository.saveWorkOrder).toHaveBeenCalledTimes(1));
    expect(repository.saveWorkOrder).toHaveBeenCalledWith(expect.objectContaining({ status: "closed", closedAt: "2026-10-19T12:00:00Z", noSignatureReason: "Cliente ausente", correctionSummary: "   Corregir materiales" }), expect.objectContaining({ role: "office" }), false);
  });

  it("rejects unsupported photos before they reach persistence", async () => {
    const user = userEvent.setup({ applyAccept: false });
    await openJobForm();
    await user.upload(screen.getByLabelText(/Añadir fotos/), new File(["fixture"], "equipo.svg", { type: "image/svg+xml" }));
    expect(screen.getByRole("alert").textContent).toContain("JPEG, PNG o WebP de hasta 10 MB");
    expect(repository.saveWorkOrder).not.toHaveBeenCalled();
  });
});

describe("closure", () => {
  it("requires a signature or an explicit reason, then closes without a signature", async () => {
    const { user, dialog } = await openClosure();
    await user.click(dialog.getByRole("button", { name: "Cerrar parte" }));
    expect(dialog.getByRole("alert").textContent).toContain("Pide al cliente que firme");
    await user.click(dialog.getByRole("checkbox"));
    await user.click(dialog.getByRole("button", { name: "Cerrar parte" }));
    expect(dialog.getByRole("alert").textContent).toContain("Explica por qué se cierra");
    expect(repository.saveWorkOrder).not.toHaveBeenCalled();
    await user.type(dialog.getByPlaceholderText("Explica el motivo"), "  Cliente ausente  ");
    await user.click(dialog.getByRole("button", { name: "Cerrar parte" }));
    await waitFor(() => expect(repository.saveWorkOrder).toHaveBeenCalledTimes(1));
    expect(repository.saveWorkOrder).toHaveBeenCalledWith(expect.objectContaining({ status: "closed", workDone: "Filtros limpios", noSignatureReason: "Cliente ausente", signatureDataUrl: "", signerName: "" }), technician, true);
  });

  it("captures a drawn signature and passes it to the signed closure", async () => {
    const { user, dialog } = await openClosure();
    await user.type(dialog.getByPlaceholderText("Nombre y apellidos"), "Persona de prueba");
    const canvas = dialog.getByLabelText("Zona para dibujar la firma");
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 30, clientY: 20 });
    fireEvent.pointerUp(canvas, { pointerId: 1 });
    await user.click(dialog.getByRole("button", { name: "Cerrar parte" }));
    await waitFor(() => expect(repository.saveWorkOrder).toHaveBeenCalledTimes(1));
    expect(repository.saveWorkOrder).toHaveBeenCalledWith(expect.objectContaining({ status: "closed", signatureDataUrl: signedImage, signerName: "Persona de prueba", noSignatureReason: "" }), technician, true);
  });

  it("shows closure failures in the dialog and keeps the reason available for retry", async () => {
    vi.mocked(repository.saveWorkOrder).mockRejectedValueOnce(new Error("No se pudo cerrar el parte. Sincroniza antes de reintentarlo."));
    const { user, dialog } = await openClosure();
    await user.click(dialog.getByRole("checkbox"));
    await user.type(dialog.getByPlaceholderText("Explica el motivo"), "Cliente ausente");
    await user.click(dialog.getByRole("button", { name: "Cerrar parte" }));
    expect((await dialog.findByRole("alert")).textContent).toContain("No se pudo cerrar el parte");
    expect((dialog.getByPlaceholderText("Explica el motivo") as HTMLTextAreaElement).value).toBe("Cliente ausente");
    expect((dialog.getByRole("button", { name: "Cerrar parte" }) as HTMLButtonElement).disabled).toBe(false);
    await user.click(dialog.getByRole("button", { name: "Cerrar parte" }));
    await waitFor(() => expect(repository.saveWorkOrder).toHaveBeenCalledTimes(2));
  });
});

describe("session lifecycle", () => {
  it("reloads after Realtime changes and releases the subscription on unmount", async () => {
    const view = render(<ClimaGestApp />);
    await screen.findByRole("button", { name: /PT-1001/ });
    state.jobs[0].number = "PT-UPDATED";
    act(() => onChange());
    await screen.findByRole("button", { name: /PT-UPDATED/ });
    expect(repository.load).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(repository.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("removes company data immediately after a signed-out event", async () => {
    await openWorkspace();
    act(() => onAuthChange(null, "SIGNED_OUT"));
    await screen.findByRole("button", { name: "Entrar" });
    expect(screen.queryByText("PT-1001")).toBeNull();
  });
});
