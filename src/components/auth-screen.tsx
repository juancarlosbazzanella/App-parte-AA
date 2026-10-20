"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, Snowflake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH, passwordError } from "@/lib/auth-policy";
import { climagestRepository } from "@/lib/climagest";

function AuthLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <main className="min-h-svh bg-[#edf5f6] text-slate-950 lg:grid lg:grid-cols-[minmax(360px,0.78fr)_1.22fr]">
    <section className="hidden flex-col justify-between border-r border-cyan-800 bg-cyan-950 p-12 text-white lg:flex xl:p-14">
      <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-cyan-500 text-cyan-950"><Snowflake className="size-6" /></span><div><p className="text-lg font-bold">ClimaGest</p><p className="text-xs text-cyan-200">Partes de trabajo</p></div></div>
      <div className="max-w-sm border-l-2 border-cyan-500 pl-7"><p className="mb-4 text-sm font-semibold text-cyan-300">Tu equipo, conectado</p><h1 className="text-4xl font-bold leading-[1.08] tracking-[-0.035em] xl:text-5xl">Cada intervención, bien guardada.</h1><p className="mt-5 text-base leading-7 text-cyan-100/80">El trabajo del día y el historial que necesitas, desde la oficina o a pie de máquina.</p></div>
      <p className="text-sm text-cyan-200/80">Acceso personal para cada miembro del equipo.</p>
    </section>
    <section className="flex min-h-svh items-center justify-center px-5 py-10 sm:px-8"><div className="w-full max-w-lg">
      <div className="mb-7 flex items-center gap-2 font-bold text-cyan-950 lg:hidden"><Snowflake className="size-6" /> ClimaGest</div>
      <Card className="overflow-hidden rounded-3xl border-slate-200 bg-white p-0 shadow-[0_24px_80px_rgba(15,54,61,0.10)]"><div className="p-6 sm:p-8">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-cyan-800"><LockKeyhole className="size-4" /> Acceso al equipo</p>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2><p className="mb-7 mt-3 text-base leading-6 text-slate-600">{description}</p>{children}
      </div><p className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-center text-sm text-slate-500">¿Necesitas una cuenta? Contacta con el administrador de tu empresa.</p></Card>
    </div></section>
  </main>;
}

export function LoginScreen({ onLogin, storageError }: { onLogin: (email: string, password: string) => Promise<void>; storageError: string }) {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      if (mode === "reset") { await climagestRepository.requestPasswordReset(email); setSent(true); }
      else await onLogin(email.trim(), password);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo completar la solicitud."); }
    finally { setBusy(false); }
  }

  return <AuthLayout title={mode === "login" ? "Entrar en ClimaGest" : "Recuperar contraseña"} description={mode === "login" ? "Introduce tu correo y contraseña para acceder a tu espacio de trabajo." : "Te enviaremos un enlace para establecer una nueva contraseña."}>
    {(error || storageError) && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error || storageError}</p>}
    {sent ? <div role="status" className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950">Si el correo tiene una cuenta, recibirás un enlace. Revisa también la carpeta de correo no deseado.</div> : <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2"><Label htmlFor="login-email">Correo</Label><Input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required maxLength={254} className="h-12 rounded-xl" /></div>
      {mode === "login" && <div className="space-y-2"><Label htmlFor="login-password">Contraseña</Label><Input id="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required className="h-12 rounded-xl" /></div>}
      <Button disabled={busy} type="submit" className="h-12 w-full bg-cyan-800 hover:bg-cyan-900">{busy ? "Un momento…" : mode === "login" ? "Entrar" : "Enviar enlace"}<ArrowRight className="size-4" /></Button>
    </form>}
    <Button variant="link" disabled={busy} className="mt-4 px-0 text-cyan-800" onClick={() => { setMode(mode === "login" ? "reset" : "login"); setError(""); setSent(false); setPassword(""); }}>{mode === "login" ? "He olvidado mi contraseña" : <><ArrowLeft className="size-4" /> Volver al acceso</>}</Button>
  </AuthLayout>;
}

export function PasswordSetupScreen({ onCancel, onComplete }: { onCancel: () => Promise<void>; onComplete: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = passwordError(password);
    if (validation) { setError(validation); return; }
    if (password !== confirmation) { setError("Las contraseñas no coinciden."); return; }
    setBusy(true); setError("");
    try { await climagestRepository.setPassword(password); setPassword(""); setConfirmation(""); setSaved(true); onComplete(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la contraseña."); }
    finally { setBusy(false); }
  }
  return <AuthLayout title={saved ? "Contraseña guardada" : "Establece tu contraseña"} description={saved ? "Ya puedes entrar con tu correo y tu nueva contraseña." : "Elige una contraseña única. Puedes generarla y guardarla con un gestor de contraseñas."}>
    {saved ? <Button onClick={onComplete} className="h-12 w-full bg-cyan-800 hover:bg-cyan-900">Ir al acceso<ArrowRight className="size-4" /></Button> : <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2"><Label htmlFor="new-password">Nueva contraseña</Label><Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={PASSWORD_MIN_LENGTH} maxLength={72} required aria-describedby="password-hint" className="h-12 rounded-xl" /><p id="password-hint" className="text-sm leading-5 text-slate-500">{PASSWORD_HINT}</p></div>
      <div className="space-y-2"><Label htmlFor="confirm-password">Repite la contraseña</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} required className="h-12 rounded-xl" /></div>
      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
      <Button type="submit" disabled={busy} className="h-12 w-full bg-cyan-800 hover:bg-cyan-900">{busy ? "Guardando…" : "Guardar contraseña"}</Button>
      <Button type="button" variant="link" disabled={busy} onClick={onCancel} className="text-cyan-800">Cancelar y salir</Button>
    </form>}
  </AuthLayout>;
}
