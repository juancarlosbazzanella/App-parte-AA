"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Mail, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ROLE_LABELS, climagestRepository, type AppState, type AppUser, type ManagedMember, type MemberInvitation, type UserRole } from "@/lib/climagest";

function RoleSelect({ value, onChange, disabled, label }: { value: UserRole; onChange: (role: UserRole) => void; disabled?: boolean; label: string }) {
  return <Select value={value} onValueChange={(role) => onChange(role as UserRole)} disabled={disabled}><SelectTrigger aria-label={label} className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>)}</SelectContent></Select>;
}

function MemberRow({ member, lastAdmin, saving, onSave }: { member: ManagedMember; lastAdmin: boolean; saving: boolean; onSave: (member: ManagedMember, role: UserRole, active: boolean) => Promise<void> }) {
  const [role, setRole] = useState(member.role);
  const [active, setActive] = useState(member.is_active);
  const historical = member.email.endsWith("@climagest.demo");
  const changed = role !== member.role || active !== member.is_active;
  return <div className="grid items-center gap-4 border-t border-slate-100 py-5 first:border-t-0 lg:grid-cols-[minmax(0,1fr)_190px_110px_150px]">
    <div className="min-w-0"><p className="font-bold text-slate-950">{member.full_name}</p><p className="break-all text-sm text-slate-500">{member.email}</p><p className="mt-1 text-xs font-semibold text-cyan-800">{historical ? "Cuenta histórica · Acceso deshabilitado" : member.invitation_pending ? "Invitación pendiente de aceptar" : member.is_active ? "Acceso activo" : "Acceso desactivado"}</p></div>
    <RoleSelect label={`Rol de ${member.full_name}`} value={role} onChange={setRole} disabled={saving || lastAdmin || historical} />
    <Label className="flex min-h-11 items-center gap-2"><Checkbox checked={active} onCheckedChange={(checked) => setActive(checked === true)} disabled={saving || lastAdmin || historical} /> Activo</Label>
    <Button variant="outline" disabled={saving || !changed || historical} onClick={() => { void onSave(member, role, active); }} className="min-h-11">{saving && changed ? "Guardando…" : "Guardar acceso"}</Button>
    {lastAdmin && <p className="text-xs text-slate-500 lg:col-span-4">Debe haber otro administrador activo antes de cambiar el acceso de esta cuenta.</p>}
  </div>;
}

export function AdminScreen({ data, user, onRefresh }: { data: AppState; user: AppUser; onRefresh: () => Promise<void> }) {
  const [members, setMembers] = useState<ManagedMember[]>([]);
  const [invitations, setInvitations] = useState<MemberInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("technician");

  const reload = useCallback(async () => {
    const [nextMembers, nextInvitations] = await Promise.all([
      climagestRepository.listMembers(data.organizationId), climagestRepository.listInvitations(data.organizationId),
    ]);
    setMembers(nextMembers); setInvitations(nextInvitations);
  }, [data.organizationId]);
  useEffect(() => {
    let active = true;
    void Promise.all([climagestRepository.listMembers(data.organizationId), climagestRepository.listInvitations(data.organizationId)])
      .then(([nextMembers, nextInvitations]) => { if (active) { setMembers(nextMembers); setInvitations(nextInvitations); } })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : "No se pudieron cargar los usuarios."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [data.organizationId]);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await climagestRepository.inviteMember(data.organizationId, email, name, role);
      setName(""); setEmail(""); setRole("technician");
      toast.success("Invitación enviada. El usuario podrá establecer su contraseña.");
      await reload(); await onRefresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo enviar la invitación."); await reload().catch(() => undefined); }
    finally { setBusy(false); }
  }

  async function updateAccess(member: ManagedMember, nextRole: UserRole, active: boolean) {
    setBusy(true); setError("");
    try { await climagestRepository.updateMember(data.organizationId, member, nextRole, active); await reload(); await onRefresh(); toast.success("Acceso actualizado"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo actualizar el acceso."); }
    finally { setBusy(false); }
  }

  const adminCount = members.filter((member) => member.role === "admin" && member.is_active).length;
  return <section className="mx-auto max-w-5xl space-y-6">
    <div><h2 className="text-3xl font-bold tracking-tight">Usuarios</h2><p className="mt-2 max-w-2xl text-slate-600">Invita a tu equipo y decide quién puede administrar, planificar o realizar los trabajos.</p></div>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
    <Card className="border-slate-200 bg-white p-5 sm:p-6"><h3 className="flex items-center gap-2 text-lg font-bold"><Mail className="size-5 text-cyan-700" /> Invitar a una persona</h3><p className="text-sm text-slate-500">Recibirá un enlace personal para elegir su contraseña.</p>
      <form onSubmit={invite} className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="space-y-2"><Label htmlFor="member-name">Nombre</Label><Input id="member-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} className="h-11" /></div>
        <div className="space-y-2"><Label htmlFor="member-email">Correo</Label><Input id="member-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={254} className="h-11" /></div>
        <div className="space-y-2"><Label>Rol</Label><RoleSelect label="Rol de la persona invitada" value={role} onChange={setRole} disabled={busy} /></div>
        <Button type="submit" disabled={busy || loading} className="min-h-11 self-end bg-cyan-800 hover:bg-cyan-900">{busy ? "Un momento…" : "Enviar invitación"}</Button>
      </form>
      <p className="mt-4 text-xs leading-5 text-slate-500">Administrador: usuarios y funciones de oficina. Oficina: clientes, máquinas y planificación. Técnico: sus trabajos y el historial autorizado.</p>
    </Card>
    <Card className="border-slate-200 bg-white p-5 sm:p-6"><h3 className="mb-2 flex items-center gap-2 text-lg font-bold"><UsersRound className="size-5 text-cyan-700" /> Equipo</h3>
      <p className="mb-3 text-sm text-slate-500">Has accedido como {user.name}. Los cambios de acceso se aplican en la base de datos al guardarlos.</p>
      {loading ? <p role="status" className="py-4 text-slate-500">Cargando equipo…</p> : members.map((member) => <MemberRow key={`${member.user_id}:${member.role}:${member.is_active}`} member={member} lastAdmin={member.role === "admin" && member.is_active && adminCount === 1} saving={busy} onSave={updateAccess} />)}
      {invitations.some((invitation) => invitation.status !== "sent") && <div className="mt-4 border-t border-slate-200 pt-4"><h4 className="font-semibold">Invitaciones sin completar</h4>{invitations.filter((invitation) => invitation.status !== "sent").map((invitation) => <p key={invitation.id} className="mt-2 break-all text-sm text-slate-600">{invitation.email} · {invitation.status === "failed" ? "No se pudo enviar; vuelve a invitar este correo." : "Preparando envío; si no se completa, vuelve a invitar este correo."}</p>)}</div>}
    </Card>
  </section>;
}
