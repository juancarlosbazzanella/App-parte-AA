import type { AppState, AppUser, WorkOrder } from "@/lib/climagest";
import type { Database } from "@/lib/database.types";

export const technician: AppUser = {
  id: "tech-a", name: "Técnica de pruebas", email: "tech@example.test", role: "technician", isActive: true,
};

export function workOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: "job-a", organizationId: "org-a", number: "PT-1001", clientId: "client-a",
    machineId: "machine-a", technicianId: technician.id, type: "Mantenimiento",
    scheduledDate: "2026-10-20", scheduledTime: "09:30", request: "Revisar filtros",
    workDone: "", hours: "", materials: "", photos: [], observations: "",
    status: "open", source: "office", createdBy: "office-a",
    createdAt: "2026-10-19T10:00:00Z", updatedAt: "2026-10-19T10:00:00Z",
    closedAt: "", signerName: "", signatureDataUrl: "", signatureStoragePath: "",
    noSignatureReason: "", corrections: [], version: 3, ...overrides,
  };
}

export function workOrderRow(overrides: Partial<Database["public"]["Tables"]["work_orders"]["Row"]> = {}): Database["public"]["Tables"]["work_orders"]["Row"] {
  return {
    id: "job-a", organization_id: "org-a", sequence_number: 1001, reference: "PT-1001",
    client_id: "client-a", machine_id: "machine-a", technician_user_id: technician.id,
    type: "maintenance", scheduled_date: "2026-10-20", scheduled_time: "09:30:00",
    request: null, work_done: null, hours: null, materials: null, observations: null,
    status: "open", source: "office", created_by_user_id: "office-a",
    created_at: "2026-10-19T10:00:00Z", updated_at: "2026-10-19T10:00:00Z",
    closed_at: null, closed_by_user_id: null, signer_name: null,
    signature_storage_path: null, no_signature_reason: null, version: 4, ...overrides,
  };
}

export function appState(overrides: Partial<AppState> = {}): AppState {
  return {
    organizationId: "org-a",
    organization: { name: "Empresa de pruebas" },
    users: [technician, { ...technician, id: "tech-b", name: "Otro técnico" }, {
      id: "office-a", name: "Oficina de pruebas", email: "office@example.test", role: "office", isActive: true,
    }, { id: "admin-a", name: "Administración de pruebas", email: "admin@example.test", role: "admin", isActive: true }],
    clients: [{ id: "client-a", name: "Clínica Álamo", email: "client@example.test", phone: "" }],
    machines: [{ id: "machine-a", clientId: "client-a", brand: "Daikin", model: "TX35", serial: "SER-001", address: "Calle del Olmo 15" }],
    jobs: [workOrder(), workOrder({ id: "job-b", number: "PT-1002", technicianId: "tech-b" })],
    ...overrides,
  };
}
