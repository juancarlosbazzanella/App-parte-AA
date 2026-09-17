"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  FileCheck2,
  FilePenLine,
  History,
  ImagePlus,
  LogOut,
  Mail,
  MapPin,
  PackageOpen,
  Pencil,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  Snowflake,
  UserRound,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/signature-pad";
import {
  DEMO_PASSWORD,
  DEMO_USERS,
  WORK_TYPES,
  climagestRepository,
  newId,
  nowLocalTime,
  todayLocal,
} from "@/lib/climagest";
import type {
  Client,
  DemoState,
  DemoUser,
  Machine,
  WorkOrder,
  WorkPhoto,
  WorkStatus,
  WorkType,
} from "@/lib/climagest";

type Screen =
  | { name: "jobs" }
  | { name: "clients" }
  | { name: "machines" }
  | { name: "job"; id: string }
  | { name: "job-form"; id?: string; urgent?: boolean }
  | { name: "client"; id: string }
  | { name: "machine"; id: string; fromJobId?: string };

type ModelContextTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: unknown) => unknown | Promise<unknown>;
};

type ModelContext = {
  registerTool: (tool: ModelContextTool, options?: { signal?: AbortSignal }) => void | Promise<void>;
};

const dateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const shortDateFormatter = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(value: string, short = false) {
  if (!value) return "Sin fecha";
  return (short ? shortDateFormatter : dateFormatter).format(new Date(`${value}T12:00:00`));
}

function formatDateTime(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function typeTone(type: WorkType) {
  return {
    Instalación: "border-emerald-200 bg-emerald-50 text-emerald-800",
    Mantenimiento: "border-sky-200 bg-sky-50 text-sky-800",
    Avería: "border-amber-200 bg-amber-50 text-amber-900",
    Revisión: "border-violet-200 bg-violet-50 text-violet-800",
  }[type];
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-500 text-cyan-950 shadow-sm ring-1 ring-cyan-300/40">
        <Snowflake className="size-5" aria-hidden="true" />
      </span>
      {!compact && (
        <div>
          <p className="text-lg font-bold tracking-[-0.02em]">ClimaGest</p>
          <p className="text-xs opacity-70">Partes de trabajo</p>
        </div>
      )}
    </div>
  );
}

function TypeBadge({ type }: { type: WorkType }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${typeTone(type)}`}>{type}</span>;
}

function StatusBadge({ status }: { status: WorkStatus }) {
  return status === "open" ? (
    <span className="rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-900">Abierto</span>
  ) : (
    <span className="rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">Cerrado</span>
  );
}

function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#edf5f6] px-5">
      <Card className="w-full max-w-md border-slate-200 bg-white p-7 shadow-xl">
        <div className="mb-7 flex items-center gap-3">
          <Skeleton className="size-11 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
        <Skeleton className="mb-3 h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </Card>
    </main>
  );
}

export function ClimaGestApp() {
  const [data, setData] = useState<DemoState | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null | undefined>(undefined);
  const [connectionError, setConnectionError] = useState("");

  useEffect(() => {
    let active = true;
    void climagestRepository.getSessionUser()
      .then((user) => {
        if (active) setActiveUserId(user?.id ?? null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setConnectionError(error instanceof Error ? error.message : "No se pudo conectar con Supabase.");
        setActiveUserId(null);
      });
    const unsubscribe = climagestRepository.onAuthStateChange((user) => {
      if (!active) return;
      setData(null);
      setActiveUserId(user?.id ?? null);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function refreshData() {
    const freshData = await climagestRepository.load();
    setData(freshData);
    setConnectionError("");
  }

  useEffect(() => {
    if (!activeUserId) return;
    let active = true;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const freshData = await climagestRepository.load();
        if (!active) return;
        setData(freshData);
        setConnectionError("");
      } catch (error) {
        if (!active) return;
        setConnectionError(error instanceof Error ? error.message : "No se pudieron cargar los datos de Supabase.");
      }
    };
    void load();
    const channel = climagestRepository.subscribe(() => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void load(), 250);
    });
    return () => {
      active = false;
      clearTimeout(refreshTimer);
      void climagestRepository.unsubscribe(channel);
    };
  }, [activeUserId]);

  async function login(email: string, password: string) {
    const user = await climagestRepository.signIn(email, password);
    setActiveUserId(user.id);
  }

  async function logout() {
    await climagestRepository.signOut();
    setData(null);
    setActiveUserId(null);
  }

  if (activeUserId === undefined) return <LoadingScreen />;
  if (!activeUserId) {
    return (
      <>
        <LoginScreen users={DEMO_USERS} onLogin={login} storageError={connectionError} />
        <Toaster position="top-right" richColors closeButton />
      </>
    );
  }
  if (!data) return <LoadingScreen />;
  const currentUser = data.users.find((user) => user.id === activeUserId);
  if (!currentUser) {
    return <LoginScreen users={DEMO_USERS} onLogin={login} storageError={connectionError || "La cuenta no tiene acceso a ClimaGest."} />;
  }

  return (
    <>
      <Workspace
        data={data}
        user={currentUser}
        storageError={connectionError}
        onLogout={logout}
        onRefresh={refreshData}
      />
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}

function LoginScreen({ users, onLogin, storageError }: { users: DemoUser[]; onLogin: (email: string, password: string) => Promise<void>; storageError: string }) {
  const [email, setEmail] = useState(users[0]?.email ?? DEMO_USERS[0].email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await onLogin(email.trim(), password);
      setError("");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesión.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-svh bg-[#edf5f6] text-slate-950 lg:grid lg:grid-cols-[minmax(360px,0.78fr)_1.22fr]">
      <section className="relative hidden border-r border-cyan-800 bg-cyan-950 p-12 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
        <Logo />
        <div className="max-w-sm border-l-2 border-cyan-500 pl-7">
          <p className="mb-4 text-sm font-semibold text-cyan-300">Acceso de prueba</p>
          <h1 className="text-4xl font-bold leading-[1.08] tracking-[-0.035em] xl:text-5xl">Cada intervención, bien guardada.</h1>
          <p className="mt-5 max-w-[38ch] text-base leading-7 text-cyan-100/80">
            Partes claros en la calle y todo el historial de cada máquina disponible cuando hace falta.
          </p>
        </div>
        <p className="text-sm text-cyan-200/80">Prototipo local · Datos ficticios</p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-lg">
          <div className="mb-8 text-cyan-950 lg:hidden"><Logo /></div>
          {storageError && (
            <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <AlertCircle className="mt-0.5 size-5 shrink-0" /> {storageError}
            </div>
          )}
          <Card className="overflow-hidden rounded-3xl border-slate-200 bg-white p-0 shadow-[0_24px_80px_rgba(15,54,61,0.10)]">
            <div className="p-6 sm:p-8">
              <div className="mb-6 border-b border-slate-100 pb-6">
                <div className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-cyan-800">
                  <CalendarDays className="size-4" /> Entorno de demostración
                </div>
                <h2 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">Entrar en ClimaGest</h2>
                <p className="mt-2 max-w-[44ch] text-base leading-6 text-slate-600">Elige un perfil de prueba y accede con las credenciales ya preparadas.</p>
              </div>

              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-bold text-slate-700">Perfil de prueba</p>
                <p className="text-xs font-medium text-slate-500">{users.length} disponibles</p>
              </div>
              <div className="mb-7 grid grid-cols-2 gap-3">
                {users.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(DEMO_PASSWORD);
                      setError("");
                    }}
                    className={`min-h-[76px] rounded-2xl border p-3.5 text-left transition-[border-color,box-shadow,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 ${
                      email === account.email ? "border-cyan-600 bg-cyan-50 shadow-sm" : "border-slate-200 bg-white hover:border-cyan-300"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-bold">
                      <UserRound className="size-4 text-cyan-700" /> {account.name}
                      {email === account.email && <CheckCircle2 className="ml-auto size-4 text-cyan-700" aria-hidden="true" />}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">{account.role === "office" ? "Gestión completa" : "Técnico"}</span>
                  </button>
                ))}
              </div>

              <form onSubmit={submit} className="space-y-5 border-t border-slate-100 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Correo</Label>
                  <Input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 rounded-xl bg-slate-50" autoComplete="username" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">{DEMO_PASSWORD}</span>
                  </div>
                  <Input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 rounded-xl bg-slate-50" autoComplete="current-password" />
                </div>
                {error && <p className="flex items-center gap-2 text-sm font-medium text-red-700"><AlertCircle className="size-4" /> {error}</p>}
                <Button type="submit" disabled={busy} className="h-12 w-full bg-cyan-800 text-base shadow-sm hover:bg-cyan-900">
                  {busy ? "Entrando…" : "Entrar"} <ArrowRight className="size-4" />
                </Button>
              </form>
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-center text-sm leading-5 text-slate-500 sm:px-8">
              Datos sincronizados con Supabase · Entorno de demostración
            </div>
          </Card>
        </div>
      </section>
    </main>
  );
}

function Workspace({
  data,
  user,
  storageError,
  onLogout,
  onRefresh,
}: {
  data: DemoState;
  user: DemoUser;
  storageError: string;
  onLogout: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [screen, setScreen] = useState<Screen>({ name: "jobs" });
  const [clientDialog, setClientDialog] = useState<{ id?: string } | null>(null);
  const [machineDialog, setMachineDialog] = useState<{ id?: string; clientId?: string } | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [screen]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const visibleJobs = () => user.role === "office" ? data.jobs : data.jobs.filter((job) => job.technicianId === user.id);

    try {
      void Promise.resolve(context.registerTool({
        name: "list_visible_work_orders",
        title: "Consultar partes visibles",
        description: "Devuelve los partes de trabajo que el perfil actual puede consultar en ClimaGest.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => visibleJobs().map((job) => ({
          number: job.number,
          status: job.status,
          type: job.type,
          scheduledDate: job.scheduledDate,
          client: data.clients.find((client) => client.id === job.clientId)?.name ?? "",
          machine: data.machines.find((machine) => machine.id === job.machineId)?.serial ?? "",
        })),
      }, { signal: lifecycle.signal })).catch(() => undefined);

      void Promise.resolve(context.registerTool({
        name: "open_work_order",
        title: "Abrir un parte",
        description: "Abre en pantalla un parte que el perfil actual tiene permiso para consultar.",
        inputSchema: {
          type: "object",
          properties: { number: { type: "string", description: "Número visible del parte, por ejemplo PT-1012." } },
          required: ["number"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: (input) => {
          const number = typeof input === "object" && input !== null && "number" in input ? String((input as { number: unknown }).number) : "";
          const job = visibleJobs().find((item) => item.number.toLowerCase() === number.toLowerCase());
          if (!job) throw new Error("El parte no existe o no es visible para este perfil.");
          setScreen({ name: "job", id: job.id });
          return { opened: job.number };
        },
      }, { signal: lifecycle.signal })).catch(() => undefined);

      void Promise.resolve(context.registerTool({
        name: "start_work_order_creation",
        title: user.role === "office" ? "Crear trabajo" : "Abrir urgencia",
        description: user.role === "office" ? "Abre el formulario para crear y asignar un nuevo trabajo." : "Abre el formulario de un parte urgente asignado al técnico actual.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: () => {
          setScreen(user.role === "office" ? { name: "job-form" } : { name: "job-form", urgent: true });
          return { started: user.role === "office" ? "planned-work" : "urgent-work" };
        },
      }, { signal: lifecycle.signal })).catch(() => undefined);
    } catch {
      return () => lifecycle.abort();
    }

    return () => lifecycle.abort();
  }, [data, user]);

  async function saveClient(client: Client) {
    await climagestRepository.saveClient(client, data.organizationId, user.id, Boolean(clientDialog?.id));
    await onRefresh();
    setClientDialog(null);
    toast.success(clientDialog?.id ? "Cliente actualizado" : "Cliente creado");
  }

  async function saveMachine(machine: Machine) {
    await climagestRepository.saveMachine(machine, data.organizationId, user.id, Boolean(machineDialog?.id));
    await onRefresh();
    setMachineDialog(null);
    toast.success(machineDialog?.id ? "Máquina actualizada" : "Máquina creada");
  }

  async function saveJob(job: WorkOrder, close = false) {
    const saved = await climagestRepository.saveWorkOrder(job, user, close);
    await onRefresh();
    setScreen({ name: "job", id: saved.id });
    if (close) toast.success("Parte cerrado. Copia enviada al cliente (simulación).", { duration: 5000 });
    else if (job.status === "closed" && user.role === "office") toast.success("Corrección guardada. Copia reenviada al cliente (simulación).", { duration: 5000 });
    else toast.success(job.id ? "Parte actualizado" : "Trabajo creado");
  }

  async function handleReset() {
    await onRefresh();
    setScreen({ name: "jobs" });
    setResetOpen(false);
    toast.success("Datos sincronizados con Supabase");
  }

  const title =
    screen.name === "clients" || screen.name === "client"
      ? "Clientes"
      : screen.name === "machines" || screen.name === "machine"
        ? "Máquinas"
        : screen.name === "job-form"
          ? screen.id
            ? "Editar parte"
            : screen.urgent
              ? "Abrir urgencia"
              : "Nuevo trabajo"
          : user.role === "office"
            ? "Partes de trabajo"
            : "Mis trabajos";

  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas" className="border-r-0 shadow-[8px_0_28px_rgba(8,51,68,0.08)]">
        <SidebarHeader className="border-b border-cyan-800 px-5 py-6">
          <Logo />
        </SidebarHeader>
        <SidebarContent className="px-3 py-5">
          <SidebarGroup>
            <SidebarGroupLabel className="text-cyan-200/80">Trabajo</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem active={screen.name === "jobs" || screen.name === "job" || (screen.name === "job-form" && !screen.urgent)} icon={FileCheck2} label={user.role === "office" ? "Partes" : "Mis trabajos"} onClick={() => setScreen({ name: "jobs" })} />
                {user.role === "technician" && (
                  <NavItem active={screen.name === "job-form" && !!screen.urgent} icon={Wrench} label="Abrir urgencia" onClick={() => setScreen({ name: "job-form", urgent: true })} />
                )}
                {user.role === "office" && (
                  <>
                    <NavItem active={screen.name === "clients" || screen.name === "client"} icon={UsersRound} label="Clientes" onClick={() => setScreen({ name: "clients" })} />
                    <NavItem active={screen.name === "machines" || screen.name === "machine"} icon={Snowflake} label="Máquinas" onClick={() => setScreen({ name: "machines" })} />
                  </>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-cyan-800 p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={() => setResetOpen(true)} className="text-cyan-100 hover:bg-cyan-800 hover:text-white">
                <RefreshCcw /> <span>Sincronizar datos</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <div className="mt-2 flex items-center gap-3 rounded-2xl border border-cyan-800 bg-cyan-900/70 p-3">
            <span className="grid size-9 place-items-center rounded-full bg-cyan-100 font-bold text-cyan-900">{user.name.charAt(0)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{user.name}</p>
              <p className="truncate text-xs text-cyan-200">{user.role === "office" ? "Oficina" : "Técnico"}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onLogout} className="text-cyan-100 hover:bg-cyan-800 hover:text-white" aria-label="Cerrar sesión">
              <LogOut className="size-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 bg-[#f3f7f8]">
        <div className="bg-cyan-950 px-4 py-1.5 text-center text-xs font-medium text-cyan-50">
          Modo de demostración · Sincronizado con Supabase · Correos simulados
        </div>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 shadow-[0_1px_12px_rgba(15,23,42,0.035)] backdrop-blur sm:px-6 lg:px-8">
          <SidebarTrigger aria-label="Abrir menú" className="size-10 md:hidden" />
          <div className="min-w-0 flex-1">
            <p className="hidden text-xs font-semibold text-cyan-700 sm:block">ClimaGest</p>
            <h1 className="truncate text-lg font-bold leading-tight tracking-tight">{title}</h1>
          </div>
          <span className="hidden rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600 sm:inline-flex">
            {user.role === "office" ? "Perfil de oficina" : `Técnico · ${user.name}`}
          </span>
          <Button variant="outline" size="sm" onClick={onLogout} className="md:hidden">
            Salir
          </Button>
        </header>

        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 lg:pb-12">
          {storageError && (
            <div className="mb-5 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <AlertCircle className="mt-0.5 size-5 shrink-0" /> {storageError}
            </div>
          )}
          {screen.name === "jobs" && (
            <JobListScreen data={data} user={user} onOpen={(id) => setScreen({ name: "job", id })} onNew={() => setScreen({ name: "job-form" })} onUrgent={() => setScreen({ name: "job-form", urgent: true })} />
          )}
          {screen.name === "job" && (
            <JobDetailScreen
              data={data}
              user={user}
              jobId={screen.id}
              onBack={() => setScreen({ name: "jobs" })}
              onEdit={() => setScreen({ name: "job-form", id: screen.id })}
              onMachine={(machineId) => setScreen({ name: "machine", id: machineId, fromJobId: screen.id })}
            />
          )}
          {screen.name === "job-form" && (
            <JobFormScreen
              key={`${screen.id ?? "new"}-${screen.urgent ? "urgent" : "planned"}`}
              data={data}
              user={user}
              jobId={screen.id}
              urgent={!!screen.urgent}
              onBack={() => screen.id ? setScreen({ name: "job", id: screen.id }) : setScreen({ name: "jobs" })}
              onSave={saveJob}
            />
          )}
          {screen.name === "clients" && user.role === "office" && (
            <ClientListScreen data={data} onOpen={(id) => setScreen({ name: "client", id })} onNew={() => setClientDialog({})} />
          )}
          {screen.name === "client" && user.role === "office" && (
            <ClientDetailScreen
              data={data}
              clientId={screen.id}
              onBack={() => setScreen({ name: "clients" })}
              onEdit={() => setClientDialog({ id: screen.id })}
              onMachine={(id) => setScreen({ name: "machine", id })}
              onNewMachine={() => setMachineDialog({ clientId: screen.id })}
            />
          )}
          {screen.name === "machines" && user.role === "office" && (
            <MachineListScreen data={data} onOpen={(id) => setScreen({ name: "machine", id })} onNew={() => setMachineDialog({})} />
          )}
          {screen.name === "machine" && (
            <MachineDetailScreen
              data={data}
              user={user}
              machineId={screen.id}
              onBack={() => {
                if (screen.fromJobId) setScreen({ name: "job", id: screen.fromJobId });
                else if (user.role === "office") setScreen({ name: "machines" });
                else setScreen({ name: "jobs" });
              }}
              onEdit={() => setMachineDialog({ id: screen.id })}
              onJob={(id) => setScreen({ name: "job", id })}
            />
          )}
        </div>
      </SidebarInset>

      {clientDialog && (
        <ClientDialog key={clientDialog.id ?? "new-client"} client={clientDialog.id ? data.clients.find((item) => item.id === clientDialog.id) : undefined} onClose={() => setClientDialog(null)} onSave={saveClient} />
      )}
      {machineDialog && (
        <MachineDialog key={machineDialog.id ?? `new-${machineDialog.clientId ?? "machine"}`} clients={data.clients} machine={machineDialog.id ? data.machines.find((item) => item.id === machineDialog.id) : undefined} initialClientId={machineDialog.clientId} onClose={() => setMachineDialog(null)} onSave={saveMachine} />
      )}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Sincronizar los datos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se volverán a cargar clientes, máquinas y partes desde Supabase sin eliminar ningún cambio.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-cyan-800 hover:bg-cyan-900">Sincronizar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}

function NavItem({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof FileCheck2; label: string; onClick: () => void }) {
  const sidebar = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={active}
        onClick={() => {
          onClick();
          if (sidebar.isMobile) sidebar.setOpenMobile(false);
        }}
        className="h-11 text-cyan-50 hover:bg-cyan-800 hover:text-white data-[active=true]:bg-cyan-500 data-[active=true]:font-bold data-[active=true]:text-cyan-950"
      >
        <Icon /> <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function JobListScreen({ data, user, onOpen, onNew, onUrgent }: { data: DemoState; user: DemoUser; onOpen: (id: string) => void; onNew: () => void; onUrgent: () => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | WorkStatus>("all");
  const available = user.role === "office" ? data.jobs : data.jobs.filter((job) => job.technicianId === user.id);
  const filtered = available
    .filter((job) => status === "all" || job.status === status)
    .filter((job) => {
      if (!query.trim()) return true;
      const client = data.clients.find((item) => item.id === job.clientId);
      const machine = data.machines.find((item) => item.id === job.machineId);
      const haystack = [job.number, job.type, client?.name, machine?.brand, machine?.model, machine?.serial, machine?.address].join(" ");
      return normalize(haystack).includes(normalize(query));
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      const left = `${a.scheduledDate}${a.scheduledTime}`;
      const right = `${b.scheduledDate}${b.scheduledTime}`;
      return a.status === "open" ? left.localeCompare(right) : right.localeCompare(left);
    });
  const openCount = available.filter((job) => job.status === "open").length;
  const closedCount = available.filter((job) => job.status === "closed").length;
  const todayCount = available.filter((job) => job.status === "open" && job.scheduledDate === todayLocal()).length;
  const openJobs = filtered.filter((job) => job.status === "open");
  const closedJobs = filtered.filter((job) => job.status === "closed");
  const groups = [
    { key: "open", title: "Abiertos", description: "Trabajos que todavía requieren actuación", jobs: openJobs },
    { key: "closed", title: "Cerrados", description: "Historial de intervenciones terminadas", jobs: closedJobs },
  ].filter((group) => group.jobs.length > 0);

  return (
    <section>
      <div className="mb-5 flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm font-semibold text-cyan-700">{formatDate(todayLocal())}</p>
          <h2 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">{user.role === "office" ? "Partes de trabajo" : `Buenos días, ${user.name}`}</h2>
          <p className="mt-1.5 text-base text-slate-600">{user.role === "office" ? `${openCount} trabajos abiertos en total.` : `Tienes ${todayCount} trabajos abiertos para hoy.`}</p>
        </div>
        <Button onClick={user.role === "office" ? onNew : onUrgent} className="min-h-12 w-full bg-cyan-800 px-5 text-base shadow-sm hover:bg-cyan-900 sm:w-auto">
          <Plus className="size-4" /> {user.role === "office" ? "Nuevo trabajo" : "Abrir urgencia"}
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
        <JobMetric label="Abiertos" value={openCount} icon={FileCheck2} />
        <JobMetric label="Para hoy" value={todayCount} icon={CalendarDays} />
        <JobMetric label="Cerrados" value={closedCount} icon={CheckCircle2} />
      </div>

      <div className="mb-6 grid gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_8px_28px_rgba(15,23,42,0.05)] sm:grid-cols-[1fr_190px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por cliente, máquina, serie o dirección" className="h-11 border-0 bg-transparent pl-11 shadow-none focus-visible:ring-0" />
        </div>
        <Select value={status} onValueChange={(value) => setStatus(value as "all" | WorkStatus)}>
          <SelectTrigger className="h-11 w-full border-0 bg-slate-50 shadow-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="open">Abiertos</SelectItem>
            <SelectItem value="closed">Cerrados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length ? (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`jobs-${group.key}`}>
              <div className="mb-3 flex items-end justify-between gap-4 px-1">
                <div>
                  <h3 id={`jobs-${group.key}`} className="text-lg font-bold tracking-tight text-slate-950">{group.title}</h3>
                  <p className="mt-0.5 hidden text-sm text-slate-500 sm:block">{group.description}</p>
                </div>
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{group.jobs.length}</span>
              </div>
              <div className="grid gap-3">
                {group.jobs.map((job) => <JobCard key={job.id} job={job} data={data} showTechnician={user.role === "office"} onClick={() => onOpen(job.id)} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty className="border border-slate-200 bg-white">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Search /></EmptyMedia>
            <EmptyTitle>No hay partes que coincidan</EmptyTitle>
            <EmptyDescription>Prueba con otro texto o cambia el estado seleccionado.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent><Button variant="outline" onClick={() => { setQuery(""); setStatus("all"); }}>Limpiar búsqueda</Button></EmptyContent>
        </Empty>
      )}
    </section>
  );
}

function JobMetric({ label, value, icon: Icon }: { label: string; value: number; icon: typeof FileCheck2 }) {
  return (
    <div className="flex min-w-0 items-center justify-center gap-2.5 border-l border-slate-100 px-2 py-3.5 first:border-l-0 sm:justify-start sm:px-5 sm:py-4">
      <span className="hidden size-9 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-800 sm:grid">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 text-center sm:text-left">
        <p className="text-xl font-bold leading-none tracking-tight text-slate-950 sm:text-2xl">{value}</p>
        <p className="mt-1 truncate text-xs font-semibold text-slate-500 sm:text-sm">{label}</p>
      </div>
    </div>
  );
}

function JobCard({ job, data, showTechnician, onClick }: { job: WorkOrder; data: DemoState; showTechnician: boolean; onClick: () => void }) {
  const client = data.clients.find((item) => item.id === job.clientId);
  const machine = data.machines.find((item) => item.id === job.machineId);
  const technician = data.users.find((item) => item.id === job.technicianId);
  return (
    <Card className={`group overflow-hidden rounded-2xl border-slate-200 border-l-4 bg-white p-0 shadow-[0_6px_24px_rgba(15,23,42,0.045)] transition-[border-color,box-shadow] hover:border-cyan-300 hover:shadow-[0_12px_34px_rgba(14,116,144,0.09)] ${job.status === "open" ? "border-l-cyan-500" : "border-l-slate-300"}`}>
      <button onClick={onClick} className="grid min-h-[132px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-600 sm:min-h-0 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-4 sm:p-5 lg:grid-cols-[auto_minmax(0,1fr)_230px_auto]">
        <span className="hidden size-11 shrink-0 place-items-center rounded-xl border border-cyan-100 bg-cyan-50 text-cyan-800 sm:grid"><Wrench className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="mb-2 flex flex-wrap items-center gap-2"><StatusBadge status={job.status} /><TypeBadge type={job.type} /><span className="text-xs font-bold tracking-wide text-slate-500">{job.number}</span></span>
          <span className="block text-lg font-bold leading-tight tracking-[-0.015em] text-slate-950">{client?.name ?? "Cliente no disponible"}</span>
          <span className="mt-1 block text-sm text-slate-600">{machine ? `${machine.brand} · ${machine.model}` : "Máquina no disponible"}</span>
          <span className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500 lg:hidden">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4" /> {formatDate(job.scheduledDate, true)}{job.scheduledTime ? ` · ${job.scheduledTime}` : ""}</span>
            {showTechnician && <span className="inline-flex items-center gap-1.5"><UserRound className="size-4" /> {technician?.name}</span>}
          </span>
        </span>
        <span className="hidden gap-2.5 border-l border-slate-100 pl-5 text-sm text-slate-600 lg:grid">
          <span className="inline-flex items-center gap-2 font-medium"><CalendarDays className="size-4 text-cyan-700" /> {formatDate(job.scheduledDate, true)}{job.scheduledTime ? ` · ${job.scheduledTime}` : ""}</span>
          {showTechnician && <span className="inline-flex items-center gap-2"><UserRound className="size-4 text-cyan-700" /> {technician?.name}</span>}
        </span>
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-400 transition-[border-color,color,transform] group-hover:translate-x-0.5 group-hover:border-cyan-300 group-hover:text-cyan-700">
          <ChevronRight className="size-4" />
        </span>
      </button>
    </Card>
  );
}

function JobDetailScreen({ data, user, jobId, onBack, onEdit, onMachine }: { data: DemoState; user: DemoUser; jobId: string; onBack: () => void; onEdit: () => void; onMachine: (id: string) => void }) {
  const job = data.jobs.find((item) => item.id === jobId);
  if (!job) return <MissingRecord label="parte" onBack={onBack} />;
  const client = data.clients.find((item) => item.id === job.clientId);
  const machine = data.machines.find((item) => item.id === job.machineId);
  const technician = data.users.find((item) => item.id === job.technicianId);
  const canEdit = user.role === "office" || (job.technicianId === user.id && job.status === "open");
  const visibleHistory = data.jobs.filter((item) => item.machineId === job.machineId && (user.role === "office" || item.status === "closed" || item.technicianId === user.id)).length;

  return (
    <section className="mx-auto max-w-5xl">
      <Button variant="ghost" onClick={onBack} className="mb-4 -ml-3 text-slate-600"><ArrowLeft className="size-4" /> Volver a los partes</Button>
      <div className="mb-6 flex flex-col justify-between gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:p-6">
        <div>
          <div className="mb-3 flex flex-wrap gap-2"><StatusBadge status={job.status} /><TypeBadge type={job.type} /></div>
          <h2 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">{client?.name}</h2>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-600"><span className="font-semibold text-slate-900">{job.number}</span><span aria-hidden="true">·</span><span>{machine?.brand} {machine?.model}</span></p>
        </div>
        {canEdit && <Button onClick={onEdit} className="min-h-12 w-full bg-cyan-800 px-5 hover:bg-cyan-900 sm:w-auto"><FilePenLine className="size-4" /> {job.status === "closed" ? "Corregir parte" : "Rellenar parte"}</Button>}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_310px]">
        <div className="space-y-5">
          <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.045)] sm:p-6">
            <h3 className="mb-5 border-b border-slate-100 pb-4 text-lg font-bold">Trabajo</h3>
            <div className="grid gap-5 sm:grid-cols-2">
              <Info label="Fecha" value={`${formatDate(job.scheduledDate)}${job.scheduledTime ? ` · ${job.scheduledTime}` : ""}`} icon={CalendarDays} />
              <Info label="Técnico" value={technician?.name ?? "Sin técnico"} icon={UserRound} />
            </div>
            <div className="mt-6 space-y-5 border-t border-slate-100 pt-6">
              <TextBlock label="Encargo o aviso" value={job.request} empty="Sin indicaciones" />
              <TextBlock label="Trabajo realizado" value={job.workDone} empty={job.status === "open" ? "Pendiente de completar" : "Sin información"} prominent />
              <div className="grid gap-5 sm:grid-cols-2"><TextBlock label="Horas" value={job.hours ? `${job.hours} h` : ""} empty="No indicadas" /><TextBlock label="Materiales" value={job.materials} empty="No indicados" /></div>
              <TextBlock label="Observaciones" value={job.observations} empty="Sin observaciones" />
            </div>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.045)] sm:p-6">
            <div className="mb-4 flex items-center justify-between"><h3 className="text-lg font-bold">Fotos</h3><span className="text-sm text-slate-500">{job.photos.length}</span></div>
            {job.photos.length ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {job.photos.map((photo) => <PhotoPreview key={photo.id} photo={photo} />)}
              </div>
            ) : <p className="text-sm text-slate-500">No se añadieron fotos a este parte.</p>}
          </Card>

          {job.status === "closed" && (
            <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.045)] sm:p-6">
              <div className="mb-5 flex items-start gap-3"><span className="grid size-10 place-items-center rounded-full bg-emerald-100 text-emerald-700"><CheckCircle2 className="size-5" /></span><div><h3 className="font-bold">Parte cerrado</h3><p className="text-sm text-slate-500">{formatDateTime(job.closedAt)}</p></div></div>
              {job.signatureDataUrl ? (
                <div><p className="mb-2 text-sm font-semibold text-slate-600">Firma del cliente{job.signerName ? ` · ${job.signerName}` : ""}</p><img src={job.signatureDataUrl} alt="Firma guardada del cliente" className="max-h-40 w-full rounded-xl border border-slate-200 bg-white object-contain" /></div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="font-bold text-amber-950">Cerrado sin firma</p><p className="mt-1 text-sm text-amber-900">{job.noSignatureReason}</p></div>
              )}
              <div className="mt-4 flex items-center gap-2 text-sm font-medium text-slate-500"><Mail className="size-4" /> Copia enviada a {client?.email} (simulación)</div>
            </Card>
          )}

          {job.corrections.length > 0 && (
            <Card className="border-amber-200 bg-amber-50 p-5 sm:p-6"><h3 className="mb-3 flex items-center gap-2 font-bold text-amber-950"><History className="size-5" /> Correcciones posteriores</h3>{job.corrections.map((correction) => <div key={correction.id} className="border-t border-amber-200 py-3 first:border-0 first:pt-0"><p className="text-sm text-amber-950">{correction.summary}</p><p className="mt-1 text-xs text-amber-800">{formatDateTime(correction.at)}</p></div>)}</Card>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.045)]">
            <h3 className="mb-4 font-bold">Máquina</h3>
            <p className="font-bold text-slate-950">{machine?.brand} {machine?.model}</p>
            <p className="mt-1 text-sm text-slate-500">N.º de serie: {machine?.serial}</p>
            <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-slate-600"><MapPin className="mt-1 size-4 shrink-0 text-cyan-700" /> {machine?.address}</p>
            {machine && <Button variant="outline" onClick={() => onMachine(machine.id)} className="mt-5 w-full"><History className="size-4" /> Ver historial ({visibleHistory})</Button>}
          </Card>
          <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.045)]"><h3 className="mb-3 font-bold">Cliente</h3><p className="font-semibold">{client?.name}</p><p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><Mail className="size-4" /> {client?.email}</p>{client?.phone && <p className="mt-2 flex items-center gap-2 text-sm text-slate-600"><Phone className="size-4" /> {client.phone}</p>}</Card>
        </aside>
      </div>
    </section>
  );
}

function TextBlock({ label, value, empty, prominent = false }: { label: string; value: string; empty: string; prominent?: boolean }) {
  return <div className={prominent ? "rounded-xl border border-slate-100 bg-slate-50 p-4" : ""}><p className="mb-1.5 text-sm font-bold text-slate-600">{label}</p><p className={`${prominent && value ? "text-lg font-medium" : "text-base"} whitespace-pre-wrap leading-7 ${value ? "text-slate-900" : "italic text-slate-400"}`}>{value || empty}</p></div>;
}

function Info({ label, value, icon: Icon }: { label: string; value: string; icon: typeof CalendarDays }) {
  return <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-800"><Icon className="size-4" /></span><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-0.5 font-semibold text-slate-900">{value}</p></div></div>;
}

function PhotoPreview({ photo }: { photo: WorkPhoto }) {
  return <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">{photo.dataUrl ? <img src={photo.dataUrl} alt={photo.name} className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center bg-gradient-to-br from-slate-100 to-cyan-50 text-cyan-800"><Camera className="size-8" /></div>}<p className="truncate px-3 py-2 text-xs font-medium text-slate-600">{photo.name}</p></div>;
}

function JobFormScreen({ data, user, jobId, urgent, onBack, onSave }: { data: DemoState; user: DemoUser; jobId?: string; urgent: boolean; onBack: () => void; onSave: (job: WorkOrder, close?: boolean) => Promise<void> }) {
  const existing = jobId ? data.jobs.find((item) => item.id === jobId) : undefined;
  const firstClient = data.clients[0];
  const firstMachine = data.machines.find((item) => item.clientId === firstClient?.id);
  const firstTechnician = data.users.find((item) => item.role === "technician");
  const [draft, setDraft] = useState<WorkOrder>(() => existing ? structuredClone(existing) : {
    id: "",
    organizationId: data.organizationId,
    number: "",
    clientId: firstClient?.id ?? "",
    machineId: firstMachine?.id ?? "",
    technicianId: user.role === "technician" ? user.id : firstTechnician?.id ?? "",
    type: "Mantenimiento",
    scheduledDate: todayLocal(),
    scheduledTime: urgent ? nowLocalTime() : "",
    request: "",
    workDone: "",
    hours: "",
    materials: "",
    photos: [],
    observations: "",
    status: "open",
    source: urgent ? "urgent" : "office",
    createdBy: user.id,
    createdAt: "",
    updatedAt: "",
    closedAt: "",
    signerName: "",
    signatureDataUrl: "",
    signatureStoragePath: "",
    noSignatureReason: "",
    corrections: [],
    version: 1,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const isCorrection = existing?.status === "closed" && user.role === "office";
  const machinesForClient = data.machines.filter((machine) => machine.clientId === draft.clientId);

  function update<K extends keyof WorkOrder>(key: K, value: WorkOrder[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setError("");
  }

  function validateBase() {
    if (!draft.clientId || !draft.machineId || !draft.technicianId || !draft.scheduledDate || !draft.type) {
      setError("Completa el cliente, la máquina, el técnico, el tipo y la fecha.");
      return false;
    }
    return true;
  }

  async function saveOpen(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateBase()) return;
    setSaving(true);
    try { await onSave(draft); } finally { setSaving(false); }
  }

  function requestClose() {
    if (!validateBase()) return;
    if (!draft.workDone.trim()) {
      setError("Para cerrar el parte debes indicar qué trabajo se ha realizado.");
      return;
    }
    setCloseOpen(true);
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    const accepted = Array.from(files).filter((file) => file.type.startsWith("image/"));
    const photos = await Promise.all(accepted.map((file) => new Promise<WorkPhoto>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ id: newId("photo"), name: file.name, dataUrl: String(reader.result ?? "") });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    })));
    update("photos", [...draft.photos, ...photos]);
  }

  const client = data.clients.find((item) => item.id === draft.clientId);
  const machine = data.machines.find((item) => item.id === draft.machineId);
  const technician = data.users.find((item) => item.id === draft.technicianId);

  return (
    <section className="mx-auto max-w-5xl">
      <Button variant="ghost" onClick={onBack} className="mb-3 -ml-3 text-slate-600"><ArrowLeft className="size-4" /> Volver</Button>
      <div className="mb-6 border-b border-slate-200 pb-5"><p className="mb-1 text-sm font-semibold text-cyan-700">{isCorrection ? `Corrección · ${draft.number}` : urgent ? "Urgencia" : existing ? draft.number : "Trabajo planificado"}</p><h2 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">{isCorrection ? "Corregir parte cerrado" : existing ? "Rellenar parte" : urgent ? "Abrir parte urgente" : "Crear trabajo"}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Completa la información de arriba abajo. Puedes guardar el parte abierto y terminarlo más tarde.</p></div>

      <form onSubmit={saveOpen} className="space-y-5">
        <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.045)] sm:p-6">
          <FormSectionHeading step="1" title="Cliente y planificación" description="Identifica dónde, cuándo y quién realizará el trabajo." />
          {user.role === "office" ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Cliente" required>
                <Select value={draft.clientId} onValueChange={(value) => { const first = data.machines.find((item) => item.clientId === value); setDraft((current) => ({ ...current, clientId: value, machineId: first?.id ?? "" })); }}>
                  <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{data.clients.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Máquina" required>
                <Select value={draft.machineId} onValueChange={(value) => update("machineId", value)}>
                  <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Selecciona una máquina" /></SelectTrigger><SelectContent>{machinesForClient.map((item) => <SelectItem key={item.id} value={item.id}>{item.brand} · {item.model}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Técnico" required>
                <Select value={draft.technicianId} onValueChange={(value) => update("technicianId", value)}>
                  <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{data.users.filter((item) => item.role === "technician").map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-[1fr_120px] gap-3"><Field label="Día" required><Input type="date" value={draft.scheduledDate} onChange={(event) => update("scheduledDate", event.target.value)} className="h-11" /></Field><Field label="Hora"><Input type="time" value={draft.scheduledTime} onChange={(event) => update("scheduledTime", event.target.value)} className="h-11" /></Field></div>
            </div>
          ) : (
            <div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2">
              {(!urgent || existing) && <Info label="Cliente" value={client?.name ?? ""} icon={Building2} />}
              {(!urgent || existing) && <Info label="Máquina" value={machine ? `${machine.brand} ${machine.model}` : ""} icon={Snowflake} />}
              <Info label="Técnico" value={technician?.name ?? ""} icon={UserRound} />
              <Info label="Fecha" value={`${formatDate(draft.scheduledDate)}${draft.scheduledTime ? ` · ${draft.scheduledTime}` : ""}`} icon={CalendarDays} />
            </div>
          )}
          {user.role === "technician" && urgent && !existing && (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <Field label="Cliente" required><Select value={draft.clientId} onValueChange={(value) => { const first = data.machines.find((item) => item.clientId === value); setDraft((current) => ({ ...current, clientId: value, machineId: first?.id ?? "" })); }}><SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{data.clients.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field>
              <Field label="Máquina" required><Select value={draft.machineId} onValueChange={(value) => update("machineId", value)}><SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{machinesForClient.map((item) => <SelectItem key={item.id} value={item.id}>{item.brand} · {item.model}</SelectItem>)}</SelectContent></Select></Field>
            </div>
          )}
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.045)] sm:p-6">
          <FormSectionHeading step="2" title="Parte de trabajo" description="Describe la intervención con la información que necesitará la oficina." />
          <div className="grid gap-5">
            <Field label="Tipo de trabajo" required><Select value={draft.type} onValueChange={(value) => update("type", value as WorkType)}><SelectTrigger className="h-11 w-full sm:max-w-sm"><SelectValue /></SelectTrigger><SelectContent>{WORK_TYPES.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Encargo o aviso" hint="Opcional"><Textarea value={draft.request} onChange={(event) => update("request", event.target.value)} placeholder="Qué solicita el cliente o qué debe revisar el técnico" className="min-h-24" /></Field>
            <Field label="Trabajo realizado" requiredAtClose><Textarea value={draft.workDone} onChange={(event) => update("workDone", event.target.value)} placeholder="Explica de forma clara qué se ha hecho" className="min-h-36" /></Field>
            <div className="grid gap-5 sm:grid-cols-[180px_1fr]"><Field label="Horas" hint="Opcional"><Input type="number" min="0" step="0.25" value={draft.hours} onChange={(event) => update("hours", event.target.value)} placeholder="Ej. 1,5" className="h-11" /></Field><Field label="Materiales utilizados" hint="Texto libre"><Textarea value={draft.materials} onChange={(event) => update("materials", event.target.value)} placeholder="Ej. Condensador 35 µF, 2 m de tubería..." className="min-h-20" /></Field></div>
            <Field label="Observaciones" hint="Opcional"><Textarea value={draft.observations} onChange={(event) => update("observations", event.target.value)} placeholder="Recomendaciones, acceso, próxima revisión..." className="min-h-24" /></Field>
          </div>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.045)] sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-5"><FormSectionHeading step="3" title="Fotos" description="Añade imágenes que ayuden a documentar la intervención." compact /><Button type="button" variant="outline" asChild><label htmlFor="job-photos" className="min-h-11 cursor-pointer"><ImagePlus className="size-4" /> Añadir fotos</label></Button><input id="job-photos" type="file" accept="image/*" multiple className="sr-only" onChange={(event) => { void addPhotos(event.target.files); event.currentTarget.value = ""; }} /></div>
          {draft.photos.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{draft.photos.map((photo) => <div key={photo.id} className="relative"><PhotoPreview photo={photo} /><Button type="button" size="icon" variant="destructive" onClick={() => update("photos", draft.photos.filter((item) => item.id !== photo.id))} className="absolute right-2 top-2 size-8" aria-label={`Quitar ${photo.name}`}><X className="size-4" /></Button></div>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500"><span className="mx-auto mb-3 grid size-11 place-items-center rounded-xl bg-white text-slate-400 shadow-sm"><Camera className="size-6" /></span>Todavía no hay fotos.<span className="mt-1 block text-xs">Se guardarán de forma privada en Supabase.</span></div>}
        </Card>

        {isCorrection && <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><AlertCircle className="mt-0.5 size-5 shrink-0" /><p>La firma original se conservará. El parte quedará marcado como corregido y se simulará el envío de una nueva copia.</p></div>}
        {error && <div role="alert" className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800"><AlertCircle className="size-5 shrink-0" />{error}</div>}
        <div className="sticky bottom-2 z-10 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_16px_45px_rgba(15,23,42,0.14)] backdrop-blur sm:flex sm:items-center sm:justify-end">
          <Button type="button" variant="outline" onClick={onBack} className="min-h-11 w-full sm:w-auto">Cancelar</Button>
          <Button type="submit" disabled={saving} variant={user.role === "technician" && !isCorrection ? "outline" : "default"} className={user.role === "office" ? "min-h-11 w-full bg-cyan-800 hover:bg-cyan-900 sm:w-auto" : "min-h-11 w-full sm:w-auto"}>{saving ? "Guardando…" : isCorrection ? "Guardar corrección" : existing ? "Guardar abierto" : urgent ? "Guardar urgencia abierta" : "Crear trabajo"}</Button>
          {user.role === "technician" && !isCorrection && <Button type="button" onClick={requestClose} disabled={saving} className="col-span-2 min-h-11 w-full bg-cyan-800 hover:bg-cyan-900 sm:w-auto"><FileCheck2 className="size-4" /> Cerrar parte</Button>}
        </div>
      </form>

      {closeOpen && <CloseJobDialog open onOpenChange={setCloseOpen} job={draft} client={client} onConfirm={async (closure) => { setSaving(true); try { await onSave({ ...draft, ...closure, status: "closed", closedAt: new Date().toISOString() }, true); } finally { setSaving(false); } }} />}
    </section>
  );
}

function FormSectionHeading({ step, title, description, compact = false }: { step: string; title: string; description: string; compact?: boolean }) {
  return (
    <div className={`flex items-start gap-3 ${compact ? "" : "mb-6 border-b border-slate-100 pb-5"}`}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-cyan-800 text-sm font-bold text-white">{step}</span>
      <div>
        <h3 className="text-lg font-bold leading-7 tracking-tight">{title}</h3>
        <p className="mt-0.5 max-w-2xl text-sm leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function Field({ label, hint, required, requiredAtClose, children }: { label: string; hint?: string; required?: boolean; requiredAtClose?: boolean; children: React.ReactNode }) {
  return <div className="space-y-2"><div className="flex items-baseline justify-between gap-3"><Label>{label}{required && <span className="text-red-600"> *</span>}</Label>{hint && <span className="text-xs text-slate-500">{hint}</span>}{requiredAtClose && <span className="text-xs font-medium text-cyan-700">Obligatorio al cerrar</span>}</div>{children}</div>;
}

function CloseJobDialog({ open, onOpenChange, job, client, onConfirm }: { open: boolean; onOpenChange: (value: boolean) => void; job: WorkOrder; client?: Client; onConfirm: (closure: Pick<WorkOrder, "signerName" | "signatureDataUrl" | "noSignatureReason">) => Promise<void> }) {
  const [signerName, setSignerName] = useState("");
  const [signature, setSignature] = useState("");
  const [withoutSignature, setWithoutSignature] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function confirm() {
    if (withoutSignature && !reason.trim()) { setError("Explica por qué se cierra el parte sin firma."); return; }
    if (!withoutSignature && !signature) { setError("Pide al cliente que firme o marca la opción de cerrar sin firma."); return; }
    setBusy(true);
    try { await onConfirm({ signerName: withoutSignature ? "" : signerName.trim(), signatureDataUrl: withoutSignature ? "" : signature, noSignatureReason: withoutSignature ? reason.trim() : "" }); onOpenChange(false); } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle className="text-2xl">Firmar y cerrar el parte</DialogTitle><DialogDescription>El cierre es inmediato y se simulará el envío de una copia a {client?.email}.</DialogDescription></DialogHeader>
        <div className="space-y-5 py-2">
          <div className="rounded-xl bg-cyan-50 p-4"><p className="text-sm font-bold text-cyan-950">{job.type} · {job.number || "Nuevo parte"}</p><p className="mt-1 line-clamp-2 text-sm text-cyan-900">{job.workDone}</p></div>
          {!withoutSignature && <><Field label="Nombre de quien firma" hint="Opcional"><Input value={signerName} onChange={(event) => setSignerName(event.target.value)} placeholder="Nombre y apellidos" className="h-11" /></Field><Field label="Firma del cliente" required><SignaturePad value={signature} onChange={(value) => { setSignature(value); setError(""); }} /></Field></>}
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4"><Checkbox checked={withoutSignature} onCheckedChange={(checked) => { setWithoutSignature(checked === true); setError(""); }} className="mt-1" /><span><span className="block font-bold">Cerrar sin firma</span><span className="mt-1 block text-sm text-slate-500">Úsalo si el cliente no está presente o no quiere firmar.</span></span></label>
          {withoutSignature && <Field label="Motivo" required><Textarea value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} placeholder="Explica el motivo" className="min-h-24" /></Field>}
          {error && <p role="alert" className="flex items-center gap-2 text-sm font-medium text-red-700"><AlertCircle className="size-4" /> {error}</p>}
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose><Button onClick={confirm} disabled={busy} className="bg-cyan-800 hover:bg-cyan-900">{busy ? "Cerrando…" : "Cerrar parte"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientListScreen({ data, onOpen, onNew }: { data: DemoState; onOpen: (id: string) => void; onNew: () => void }) {
  const [query, setQuery] = useState("");
  const filtered = data.clients.filter((client) => {
    const machines = data.machines.filter((machine) => machine.clientId === client.id);
    return normalize([client.name, client.email, client.phone, ...machines.flatMap((machine) => [machine.brand, machine.model, machine.serial, machine.address])].join(" ")).includes(normalize(query));
  });
  return <section><PageHeading eyebrow={`${data.clients.length} clientes`} title="Clientes" description="Consulta sus máquinas y todo el trabajo relacionado." action={<Button onClick={onNew} className="min-h-12 bg-cyan-800 px-5 hover:bg-cyan-900"><Plus className="size-4" /> Nuevo cliente</Button>} /><SearchBox value={query} onChange={setQuery} placeholder="Buscar cliente, correo, máquina o dirección" />
    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((client) => { const machineCount = data.machines.filter((machine) => machine.clientId === client.id).length; return <Card key={client.id} className="group overflow-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-[0_6px_24px_rgba(15,23,42,0.045)] transition-[border-color,box-shadow] hover:border-cyan-300 hover:shadow-[0_12px_30px_rgba(14,116,144,0.08)]"><button onClick={() => onOpen(client.id)} className="flex min-h-44 w-full flex-col p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-600"><span className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl border border-cyan-100 bg-cyan-50 text-cyan-800"><Building2 className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-lg font-bold tracking-tight">{client.name}</span><span className="mt-1 block truncate text-sm text-slate-500">{client.email}</span></span></span><span className="mt-auto flex items-center justify-between border-t border-slate-100 pt-4 text-sm"><span className="font-semibold text-cyan-800">{machineCount} {machineCount === 1 ? "máquina" : "máquinas"}</span><span className="inline-flex items-center gap-1 font-semibold text-slate-500 transition-colors group-hover:text-cyan-800">Ver ficha <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span></span></button></Card>; })}</div>
    {!filtered.length && <NoSearchResults onClear={() => setQuery("")} />}
  </section>;
}

function ClientDetailScreen({ data, clientId, onBack, onEdit, onMachine, onNewMachine }: { data: DemoState; clientId: string; onBack: () => void; onEdit: () => void; onMachine: (id: string) => void; onNewMachine: () => void }) {
  const client = data.clients.find((item) => item.id === clientId);
  if (!client) return <MissingRecord label="cliente" onBack={onBack} />;
  const machines = data.machines.filter((item) => item.clientId === clientId);
  return <section className="mx-auto max-w-5xl"><Button variant="ghost" onClick={onBack} className="mb-4 -ml-3 text-slate-600"><ArrowLeft className="size-4" /> Volver a clientes</Button><PageHeading eyebrow="Ficha del cliente" title={client.name} description={client.email} action={<Button variant="outline" onClick={onEdit}><Pencil className="size-4" /> Editar cliente</Button>} />
    <Card className="mb-7 grid gap-5 rounded-2xl border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.045)] sm:grid-cols-2 sm:p-6"><Info label="Correo" value={client.email} icon={Mail} /><Info label="Teléfono" value={client.phone || "No indicado"} icon={Phone} /></Card>
    <div className="mb-4 flex items-end justify-between gap-3"><div><div className="flex items-center gap-2"><h3 className="text-xl font-bold">Máquinas</h3><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{machines.length}</span></div><p className="mt-1 text-sm text-slate-500">Cada equipo conserva su propio historial.</p></div><Button onClick={onNewMachine} className="min-h-11 bg-cyan-800 hover:bg-cyan-900"><Plus className="size-4" /> Añadir máquina</Button></div>
    {machines.length ? <div className="grid gap-4 sm:grid-cols-2">{machines.map((machine) => <MachineCard key={machine.id} machine={machine} client={client} onClick={() => onMachine(machine.id)} />)}</div> : <Empty className="rounded-2xl border border-slate-200 bg-white"><EmptyHeader><EmptyMedia variant="icon"><Snowflake /></EmptyMedia><EmptyTitle>Este cliente aún no tiene máquinas</EmptyTitle><EmptyDescription>Añade el primer equipo para comenzar a registrar su historial.</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={onNewMachine} className="bg-cyan-800 hover:bg-cyan-900"><Plus className="size-4" /> Añadir máquina</Button></EmptyContent></Empty>}
  </section>;
}

function MachineListScreen({ data, onOpen, onNew }: { data: DemoState; onOpen: (id: string) => void; onNew: () => void }) {
  const [query, setQuery] = useState("");
  const filtered = data.machines.filter((machine) => { const client = data.clients.find((item) => item.id === machine.clientId); return normalize([client?.name, machine.brand, machine.model, machine.serial, machine.address].join(" ")).includes(normalize(query)); });
  return <section><PageHeading eyebrow={`${data.machines.length} máquinas`} title="Máquinas" description="Equipos identificados por cliente y ubicación." action={<Button onClick={onNew} className="min-h-12 bg-cyan-800 px-5 hover:bg-cyan-900"><Plus className="size-4" /> Nueva máquina</Button>} /><SearchBox value={query} onChange={setQuery} placeholder="Buscar cliente, marca, modelo, serie o dirección" /><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map((machine) => <MachineCard key={machine.id} machine={machine} client={data.clients.find((item) => item.id === machine.clientId)} onClick={() => onOpen(machine.id)} />)}</div>{!filtered.length && <NoSearchResults onClear={() => setQuery("")} />}</section>;
}

function MachineCard({ machine, client, onClick }: { machine: Machine; client?: Client; onClick: () => void }) {
  return <Card className="group overflow-hidden rounded-2xl border-slate-200 bg-white p-0 shadow-[0_6px_24px_rgba(15,23,42,0.045)] transition-[border-color,box-shadow] hover:border-cyan-300 hover:shadow-[0_12px_30px_rgba(14,116,144,0.08)]"><button onClick={onClick} className="flex min-h-56 w-full flex-col p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-600"><span className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl border border-cyan-100 bg-cyan-50 text-cyan-800"><Snowflake className="size-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-cyan-800">{client?.name}</span><span className="mt-0.5 block text-lg font-bold tracking-tight">{machine.brand} {machine.model}</span><span className="mt-1 block text-sm text-slate-500">S/N {machine.serial}</span></span></span><span className="mt-5 flex flex-1 items-start gap-2 border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600"><MapPin className="mt-1 size-4 shrink-0 text-cyan-700" />{machine.address}</span><span className="mt-3 inline-flex items-center justify-end gap-1 text-sm font-semibold text-slate-500 transition-colors group-hover:text-cyan-800">Ver historial <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span></button></Card>;
}

function MachineDetailScreen({ data, user, machineId, onBack, onEdit, onJob }: { data: DemoState; user: DemoUser; machineId: string; onBack: () => void; onEdit: () => void; onJob: (id: string) => void }) {
  const machine = data.machines.find((item) => item.id === machineId);
  if (!machine) return <MissingRecord label="máquina" onBack={onBack} />;
  const client = data.clients.find((item) => item.id === machine.clientId);
  const history = data.jobs.filter((job) => job.machineId === machineId && (user.role === "office" || job.status === "closed" || job.technicianId === user.id)).sort((a, b) => `${b.scheduledDate}${b.scheduledTime}`.localeCompare(`${a.scheduledDate}${a.scheduledTime}`));
  return <section className="mx-auto max-w-5xl"><Button variant="ghost" onClick={onBack} className="mb-4 -ml-3 text-slate-600"><ArrowLeft className="size-4" /> Volver</Button><PageHeading eyebrow={client?.name ?? "Máquina"} title={`${machine.brand} ${machine.model}`} description={`N.º de serie ${machine.serial}`} action={user.role === "office" ? <Button variant="outline" onClick={onEdit}><Pencil className="size-4" /> Editar máquina</Button> : undefined} />
    <Card className="mb-7 grid gap-5 rounded-2xl border-slate-200 bg-white p-5 shadow-[0_8px_28px_rgba(15,23,42,0.045)] sm:grid-cols-2 sm:p-6"><Info label="Cliente" value={client?.name ?? ""} icon={Building2} /><Info label="Ubicación" value={machine.address} icon={MapPin} /></Card>
    <div className="mb-4"><div className="flex items-center gap-2"><h3 className="text-xl font-bold">Historial de la máquina</h3><span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600">{history.length}</span></div><p className="mt-1 text-sm text-slate-500">Los trabajos aparecen del más reciente al más antiguo.</p></div>
    {history.length ? <div className="grid gap-4">{history.map((job) => <JobCard key={job.id} job={job} data={data} showTechnician onClick={() => onJob(job.id)} />)}</div> : <Empty className="border border-slate-200 bg-white"><EmptyHeader><EmptyMedia variant="icon"><History /></EmptyMedia><EmptyTitle>Sin historial todavía</EmptyTitle><EmptyDescription>Los partes de esta máquina aparecerán aquí.</EmptyDescription></EmptyHeader></Empty>}
  </section>;
}

function ClientDialog({ client, onClose, onSave }: { client?: Client; onClose: () => void; onSave: (client: Client) => Promise<void> }) {
  const [name, setName] = useState(client?.name ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!name.trim() || !email.trim()) { setError("El nombre y el correo son obligatorios."); return; } setBusy(true); try { await onSave({ id: client?.id ?? newId("client"), name: name.trim(), email: email.trim(), phone: phone.trim() }); } finally { setBusy(false); } }
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>{client ? "Editar cliente" : "Nuevo cliente"}</DialogTitle><DialogDescription>La dirección se guarda en cada máquina, no en el cliente.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-5"><Field label="Nombre o empresa" required><Input value={name} onChange={(event) => { setName(event.target.value); setError(""); }} className="h-11" autoFocus /></Field><Field label="Correo" required><Input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} className="h-11" /></Field><Field label="Teléfono" hint="Opcional"><Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="h-11" /></Field>{error && <p className="text-sm font-medium text-red-700">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy} className="bg-cyan-800 hover:bg-cyan-900">{busy ? "Guardando…" : "Guardar cliente"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function MachineDialog({ clients, machine, initialClientId, onClose, onSave }: { clients: Client[]; machine?: Machine; initialClientId?: string; onClose: () => void; onSave: (machine: Machine) => Promise<void> }) {
  const [clientId, setClientId] = useState(machine?.clientId ?? initialClientId ?? clients[0]?.id ?? "");
  const [brand, setBrand] = useState(machine?.brand ?? "");
  const [model, setModel] = useState(machine?.model ?? "");
  const [serial, setSerial] = useState(machine?.serial ?? "");
  const [address, setAddress] = useState(machine?.address ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); if (!clientId || !brand.trim() || !model.trim() || !serial.trim() || !address.trim()) { setError("Completa todos los datos de la máquina."); return; } setBusy(true); try { await onSave({ id: machine?.id ?? newId("machine"), clientId, brand: brand.trim(), model: model.trim(), serial: serial.trim(), address: address.trim() }); } finally { setBusy(false); } }
  return <Dialog open onOpenChange={(open) => !open && onClose()}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{machine ? "Editar máquina" : "Nueva máquina"}</DialogTitle><DialogDescription>El equipo quedará asociado a un único cliente.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-5"><Field label="Cliente" required><Select value={clientId} onValueChange={setClientId}><SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>)}</SelectContent></Select></Field><div className="grid gap-5 sm:grid-cols-2"><Field label="Marca" required><Input value={brand} onChange={(event) => { setBrand(event.target.value); setError(""); }} className="h-11" /></Field><Field label="Modelo" required><Input value={model} onChange={(event) => setModel(event.target.value)} className="h-11" /></Field></div><Field label="Número de serie" required><Input value={serial} onChange={(event) => setSerial(event.target.value)} className="h-11" /></Field><Field label="Dirección de instalación" required><Textarea value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Dirección y ubicación dentro del edificio" className="min-h-24" /></Field>{error && <p className="text-sm font-medium text-red-700">{error}</p>}<DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={busy} className="bg-cyan-800 hover:bg-cyan-900">{busy ? "Guardando…" : "Guardar máquina"}</Button></DialogFooter></form></DialogContent></Dialog>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end"><div><p className="mb-1 text-sm font-semibold text-cyan-700">{eyebrow}</p><h2 className="text-3xl font-bold tracking-[-0.035em] sm:text-4xl">{title}</h2><p className="mt-1.5 max-w-2xl text-base leading-6 text-slate-600">{description}</p></div>{action}</div>;
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <div className="relative rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_8px_28px_rgba(15,23,42,0.05)]"><Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-slate-400" /><Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-11 border-0 bg-transparent pl-10 shadow-none focus-visible:ring-0" /></div>;
}

function NoSearchResults({ onClear }: { onClear: () => void }) {
  return <Empty className="mt-5 border border-slate-200 bg-white"><EmptyHeader><EmptyMedia variant="icon"><Search /></EmptyMedia><EmptyTitle>Sin resultados</EmptyTitle><EmptyDescription>No encontramos ningún registro que coincida con la búsqueda.</EmptyDescription></EmptyHeader><EmptyContent><Button variant="outline" onClick={onClear}>Limpiar búsqueda</Button></EmptyContent></Empty>;
}

function MissingRecord({ label, onBack }: { label: string; onBack: () => void }) {
  return <Empty className="border border-slate-200 bg-white"><EmptyHeader><EmptyMedia variant="icon"><PackageOpen /></EmptyMedia><EmptyTitle>No encontramos este {label}</EmptyTitle><EmptyDescription>Puede que el registro se haya archivado o que no tengas permiso para verlo.</EmptyDescription></EmptyHeader><EmptyContent><Button onClick={onBack}>Volver</Button></EmptyContent></Empty>;
}
