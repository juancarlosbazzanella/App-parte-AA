import type { RealtimeChannel, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabase } from "@/lib/supabase";

export type UserRole = "office" | "technician";
export type WorkStatus = "open" | "closed";
export type WorkType = "Instalación" | "Mantenimiento" | "Avería" | "Revisión";

type WorkOrderRow = Database["public"]["Tables"]["work_orders"]["Row"];
type WorkOrderType = Database["public"]["Enums"]["work_order_type"];

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
};

export type Machine = {
  id: string;
  clientId: string;
  brand: string;
  model: string;
  serial: string;
  address: string;
};

export type WorkPhoto = {
  id: string;
  name: string;
  dataUrl: string;
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
};

export type Correction = {
  id: string;
  at: string;
  byUserId: string;
  summary: string;
};

export type WorkOrder = {
  id: string;
  organizationId: string;
  number: string;
  clientId: string;
  machineId: string;
  technicianId: string;
  type: WorkType;
  scheduledDate: string;
  scheduledTime: string;
  request: string;
  workDone: string;
  hours: string;
  materials: string;
  photos: WorkPhoto[];
  observations: string;
  status: WorkStatus;
  source: "office" | "urgent";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  closedAt: string;
  signerName: string;
  signatureDataUrl: string;
  signatureStoragePath: string;
  noSignatureReason: string;
  corrections: Correction[];
  version: number;
};

export type DemoState = {
  organizationId: string;
  users: DemoUser[];
  clients: Client[];
  machines: Machine[];
  jobs: WorkOrder[];
  nextJobNumber: number;
};

export const DEMO_PASSWORD = "demo1234";
export const WORK_TYPES: WorkType[] = ["Instalación", "Mantenimiento", "Avería", "Revisión"];

export const DEMO_USERS: DemoUser[] = [
  { id: "20000000-0000-4000-8000-000000000001", name: "Oficina", email: "oficina@climagest.demo", role: "office" },
  { id: "20000000-0000-4000-8000-000000000002", name: "Álvaro", email: "alvaro@climagest.demo", role: "technician" },
  { id: "20000000-0000-4000-8000-000000000003", name: "Lucía", email: "lucia@climagest.demo", role: "technician" },
  { id: "20000000-0000-4000-8000-000000000004", name: "Marcos", email: "marcos@climagest.demo", role: "technician" },
];

const typeToDatabase: Record<WorkType, WorkOrderType> = {
  Instalación: "installation",
  Mantenimiento: "maintenance",
  Avería: "breakdown",
  Revisión: "inspection",
};

const typeFromDatabase: Record<WorkOrderType, WorkType> = {
  installation: "Instalación",
  maintenance: "Mantenimiento",
  breakdown: "Avería",
  inspection: "Revisión",
};

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed || null;
}

function optionalNumber(value: string) {
  return value.trim() ? Number(value) : null;
}

function assertNoError(error: { message: string } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback);
}

function emailForUser(userId: string) {
  return DEMO_USERS.find((user) => user.id === userId)?.email ?? "";
}

function extensionForMime(mimeType: string) {
  return {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  }[mimeType] ?? "img";
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("No se pudo preparar el archivo para subirlo.");
  return response.blob();
}

async function signedUrlMap(paths: string[]) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  if (!uniquePaths.length) return new Map<string, string>();
  const { data, error } = await supabase.storage
    .from("work-order-files")
    .createSignedUrls(uniquePaths, 60 * 60);
  assertNoError(error, "No se pudieron abrir los archivos privados.");
  return new Map(
    (data ?? [])
      .filter((item) => item.signedUrl)
      .map((item) => [item.path, item.signedUrl]),
  );
}

async function currentAuthUser() {
  const { data, error } = await supabase.auth.getUser();
  assertNoError(error, "No se pudo comprobar la sesión.");
  if (!data.user) throw new Error("La sesión ha caducado. Vuelve a iniciar sesión.");
  return data.user;
}

async function syncPhotos(
  organizationId: string,
  workOrderId: string,
  userId: string,
  photos: WorkPhoto[],
) {
  const { data: storedPhotos, error: selectError } = await supabase
    .from("work_order_photos")
    .select("id, storage_path")
    .eq("work_order_id", workOrderId);
  assertNoError(selectError, "No se pudieron comprobar las fotografías.");

  const desiredIds = new Set(photos.map((photo) => photo.id));
  const removed = (storedPhotos ?? []).filter((photo) => !desiredIds.has(photo.id));
  if (removed.length) {
    const { error: storageError } = await supabase.storage
      .from("work-order-files")
      .remove(removed.map((photo) => photo.storage_path));
    assertNoError(storageError, "No se pudieron eliminar las fotografías retiradas.");
    const { error: deleteError } = await supabase
      .from("work_order_photos")
      .delete()
      .in("id", removed.map((photo) => photo.id));
    assertNoError(deleteError, "No se pudieron eliminar las fotografías retiradas.");
  }

  const storedIds = new Set((storedPhotos ?? []).map((photo) => photo.id));
  for (const [index, photo] of photos.entries()) {
    if (storedIds.has(photo.id)) continue;
    if (!photo.dataUrl.startsWith("data:")) continue;
    const blob = await dataUrlToBlob(photo.dataUrl);
    const mimeType = blob.type || photo.mimeType || "image/jpeg";
    const storagePath = `${organizationId}/${workOrderId}/photos/${photo.id}.${extensionForMime(mimeType)}`;
    const { error: uploadError } = await supabase.storage
      .from("work-order-files")
      .upload(storagePath, blob, { contentType: mimeType, upsert: false });
    assertNoError(uploadError, `No se pudo subir ${photo.name}.`);

    const { error: insertError } = await supabase
      .from("work_order_photos")
      .insert({
        id: photo.id,
        organization_id: organizationId,
        work_order_id: workOrderId,
        storage_path: storagePath,
        original_filename: photo.name,
        mime_type: mimeType,
        size_bytes: blob.size,
        sort_order: index,
        uploaded_by_user_id: userId,
      });
    if (insertError) {
      await supabase.storage.from("work-order-files").remove([storagePath]);
      throw new Error(insertError.message);
    }
  }
}

async function uploadSignature(
  organizationId: string,
  workOrderId: string,
  signatureDataUrl: string,
  existingPath: string,
) {
  if (existingPath) return existingPath;
  if (!signatureDataUrl.startsWith("data:")) return "";
  const blob = await dataUrlToBlob(signatureDataUrl);
  const mimeType = blob.type || "image/png";
  const path = `${organizationId}/${workOrderId}/signature/${crypto.randomUUID()}.${extensionForMime(mimeType)}`;
  const { error } = await supabase.storage
    .from("work-order-files")
    .upload(path, blob, { contentType: mimeType, upsert: false });
  assertNoError(error, "No se pudo guardar la firma.");
  return path;
}

function commonWorkOrderArgs(job: WorkOrder) {
  return {
    p_type: typeToDatabase[job.type],
    p_request: optionalText(job.request) as unknown as string,
    p_work_done: optionalText(job.workDone) as unknown as string,
    p_hours: optionalNumber(job.hours) as unknown as number,
    p_materials: optionalText(job.materials) as unknown as string,
    p_observations: optionalText(job.observations) as unknown as string,
  };
}

export const climagestRepository = {
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    assertNoError(error, "No se pudo iniciar sesión.");
    if (!data.user) throw new Error("Supabase no devolvió un usuario autenticado.");
    return data.user;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    assertNoError(error, "No se pudo cerrar la sesión.");
  },

  async getSessionUser() {
    const { data, error } = await supabase.auth.getSession();
    assertNoError(error, "No se pudo recuperar la sesión.");
    return data.session?.user ?? null;
  },

  onAuthStateChange(callback: (user: User | null) => void) {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  },

  subscribe(onChange: () => void): RealtimeChannel {
    return supabase
      .channel(`climagest-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "machines" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "work_orders" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "work_order_photos" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "work_order_corrections" }, onChange)
      .subscribe();
  },

  async unsubscribe(channel: RealtimeChannel) {
    await supabase.removeChannel(channel);
  },

  async load(): Promise<DemoState> {
    const authUser = await currentAuthUser();
    const { data: ownMemberships, error: ownMembershipError } = await supabase
      .from("organization_members")
      .select("organization_id, user_id, role, is_active")
      .eq("user_id", authUser.id)
      .eq("is_active", true)
      .limit(1);
    assertNoError(ownMembershipError, "No se pudo cargar la pertenencia a la empresa.");
    const organizationId = ownMemberships?.[0]?.organization_id;
    if (!organizationId) throw new Error("Tu cuenta no pertenece a ninguna empresa activa.");

    const [organizationResult, membersResult, profilesResult, clientsResult, machinesResult, jobsResult, photosResult, correctionsResult] = await Promise.all([
      supabase.from("organizations").select("id, next_work_order_number").eq("id", organizationId).single(),
      supabase.from("organization_members").select("organization_id, user_id, role, is_active").eq("organization_id", organizationId).eq("is_active", true),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("clients").select("id, name, email, phone").eq("organization_id", organizationId).is("archived_at", null).order("name"),
      supabase.from("machines").select("id, client_id, brand, model, serial_number, installation_address").eq("organization_id", organizationId).is("archived_at", null).order("brand"),
      supabase.from("work_orders").select("*").eq("organization_id", organizationId),
      supabase.from("work_order_photos").select("*").eq("organization_id", organizationId).order("sort_order"),
      supabase.from("work_order_corrections").select("*").eq("organization_id", organizationId).order("created_at"),
    ]);

    for (const result of [organizationResult, membersResult, profilesResult, clientsResult, machinesResult, jobsResult, photosResult, correctionsResult]) {
      assertNoError(result.error, "No se pudieron cargar los datos de ClimaGest.");
    }

    const profileById = new Map((profilesResult.data ?? []).map((profile) => [profile.id, profile]));
    const users: DemoUser[] = (membersResult.data ?? []).map((member) => ({
      id: member.user_id,
      name: profileById.get(member.user_id)?.full_name ?? "Usuario",
      email: emailForUser(member.user_id),
      role: member.role,
    }));

    const filePaths = [
      ...(photosResult.data ?? []).map((photo) => photo.storage_path),
      ...(jobsResult.data ?? []).map((job) => job.signature_storage_path ?? ""),
    ];
    const urls = await signedUrlMap(filePaths);
    const photosByWorkOrder = new Map<string, WorkPhoto[]>();
    for (const photo of photosResult.data ?? []) {
      const group = photosByWorkOrder.get(photo.work_order_id) ?? [];
      group.push({
        id: photo.id,
        name: photo.original_filename,
        dataUrl: urls.get(photo.storage_path) ?? "",
        storagePath: photo.storage_path,
        mimeType: photo.mime_type,
        sizeBytes: photo.size_bytes,
      });
      photosByWorkOrder.set(photo.work_order_id, group);
    }

    const correctionsByWorkOrder = new Map<string, Correction[]>();
    for (const correction of correctionsResult.data ?? []) {
      const group = correctionsByWorkOrder.get(correction.work_order_id) ?? [];
      group.push({
        id: correction.id,
        at: correction.created_at,
        byUserId: correction.corrected_by_user_id,
        summary: correction.summary,
      });
      correctionsByWorkOrder.set(correction.work_order_id, group);
    }

    const jobs: WorkOrder[] = (jobsResult.data ?? []).map((job) => ({
      id: job.id,
      organizationId: job.organization_id,
      number: job.reference,
      clientId: job.client_id,
      machineId: job.machine_id,
      technicianId: job.technician_user_id,
      type: typeFromDatabase[job.type],
      scheduledDate: job.scheduled_date,
      scheduledTime: job.scheduled_time?.slice(0, 5) ?? "",
      request: job.request ?? "",
      workDone: job.work_done ?? "",
      hours: job.hours === null ? "" : String(job.hours),
      materials: job.materials ?? "",
      photos: photosByWorkOrder.get(job.id) ?? [],
      observations: job.observations ?? "",
      status: job.status,
      source: job.source,
      createdBy: job.created_by_user_id,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
      closedAt: job.closed_at ?? "",
      signerName: job.signer_name ?? "",
      signatureDataUrl: job.signature_storage_path ? urls.get(job.signature_storage_path) ?? "" : "",
      signatureStoragePath: job.signature_storage_path ?? "",
      noSignatureReason: job.no_signature_reason ?? "",
      corrections: correctionsByWorkOrder.get(job.id) ?? [],
      version: job.version,
    }));

    return {
      organizationId,
      users,
      clients: (clientsResult.data ?? []).map((client) => ({
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone ?? "",
      })),
      machines: (machinesResult.data ?? []).map((machine) => ({
        id: machine.id,
        clientId: machine.client_id,
        brand: machine.brand,
        model: machine.model,
        serial: machine.serial_number,
        address: machine.installation_address,
      })),
      jobs,
      nextJobNumber: organizationResult.data?.next_work_order_number ?? 1,
    };
  },

  async saveClient(client: Client, organizationId: string, userId: string, exists: boolean) {
    if (exists) {
      const { error } = await supabase
        .from("clients")
        .update({ name: client.name, email: client.email, phone: optionalText(client.phone) })
        .eq("id", client.id)
        .eq("organization_id", organizationId);
      assertNoError(error, "No se pudo actualizar el cliente.");
      return;
    }
    const { error } = await supabase.from("clients").insert({
      id: client.id,
      organization_id: organizationId,
      name: client.name,
      email: client.email,
      phone: optionalText(client.phone),
      created_by_user_id: userId,
    });
    assertNoError(error, "No se pudo crear el cliente.");
  },

  async saveMachine(machine: Machine, organizationId: string, userId: string, exists: boolean) {
    if (exists) {
      const { error } = await supabase
        .from("machines")
        .update({
          client_id: machine.clientId,
          brand: machine.brand,
          model: machine.model,
          serial_number: machine.serial,
          installation_address: machine.address,
        })
        .eq("id", machine.id)
        .eq("organization_id", organizationId);
      assertNoError(error, "No se pudo actualizar la máquina.");
      return;
    }
    const { error } = await supabase.from("machines").insert({
      id: machine.id,
      organization_id: organizationId,
      client_id: machine.clientId,
      brand: machine.brand,
      model: machine.model,
      serial_number: machine.serial,
      installation_address: machine.address,
      created_by_user_id: userId,
    });
    assertNoError(error, "No se pudo crear la máquina.");
  },

  async saveWorkOrder(job: WorkOrder, currentUser: DemoUser, close = false) {
    let row: WorkOrderRow;
    let workOrderId = job.id;
    let expectedVersion = job.version;

    if (!workOrderId) {
      const { data, error } = await supabase.rpc("create_work_order", {
        p_organization_id: job.organizationId,
        p_client_id: job.clientId,
        p_machine_id: job.machineId,
        p_technician_user_id: job.technicianId,
        p_scheduled_date: job.scheduledDate,
        p_scheduled_time: optionalText(job.scheduledTime) as unknown as string,
        p_source: job.source,
        ...commonWorkOrderArgs(job),
      });
      assertNoError(error, "No se pudo crear el parte.");
      if (!data) throw new Error("Supabase no devolvió el parte creado.");
      row = data;
      workOrderId = data.id;
      expectedVersion = data.version;
    } else if (job.status === "closed" && !close) {
      const { data, error } = await supabase.rpc("correct_closed_work_order", {
        p_work_order_id: job.id,
        p_expected_version: job.version,
        p_client_id: job.clientId,
        p_machine_id: job.machineId,
        p_technician_user_id: job.technicianId,
        p_scheduled_date: job.scheduledDate,
        p_scheduled_time: optionalText(job.scheduledTime) as unknown as string,
        p_summary: "La oficina corrigió los datos del parte después de su cierre.",
        ...commonWorkOrderArgs(job),
      });
      assertNoError(error, "No se pudo guardar la corrección.");
      if (!data) throw new Error("Supabase no devolvió el parte corregido.");
      row = data;
      expectedVersion = data.version;
    } else if (!close) {
      const { data, error } = await supabase.rpc("update_open_work_order", {
        p_work_order_id: job.id,
        p_expected_version: job.version,
        p_client_id: job.clientId,
        p_machine_id: job.machineId,
        p_technician_user_id: job.technicianId,
        p_scheduled_date: job.scheduledDate,
        p_scheduled_time: optionalText(job.scheduledTime) as unknown as string,
        ...commonWorkOrderArgs(job),
      });
      assertNoError(error, "No se pudo actualizar el parte.");
      if (!data) throw new Error("Supabase no devolvió el parte actualizado.");
      row = data;
      expectedVersion = data.version;
    } else {
      row = {} as WorkOrderRow;
    }

    await syncPhotos(job.organizationId, workOrderId, currentUser.id, job.photos);

    if (close) {
      const uploadedSignaturePath = await uploadSignature(
        job.organizationId,
        workOrderId,
        job.signatureDataUrl,
        job.signatureStoragePath,
      );
      const { data, error } = await supabase.rpc("close_work_order", {
        p_work_order_id: workOrderId,
        p_expected_version: expectedVersion,
        p_signer_name: optionalText(job.signerName) as unknown as string,
        p_signature_storage_path: optionalText(uploadedSignaturePath) as unknown as string,
        p_no_signature_reason: optionalText(job.noSignatureReason) as unknown as string,
        ...commonWorkOrderArgs(job),
      });
      if (error) {
        if (uploadedSignaturePath && !job.signatureStoragePath) {
          await supabase.storage.from("work-order-files").remove([uploadedSignaturePath]);
        }
        throw new Error(error.message);
      }
      if (!data) throw new Error("Supabase no devolvió el parte cerrado.");
      row = data;
    }

    return { id: row.id, reference: row.reference };
  },
};

export function newId(prefix?: string) {
  void prefix;
  return crypto.randomUUID();
}

export function todayLocal() {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nowLocalTime() {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
