import { beforeEach, describe, expect, it, vi } from "vitest";
import { climagestRepository as repository } from "@/lib/climagest";
import { supabaseMock as db } from "./helpers/supabase";

const authUser = { id: "tech-a", email: "tech@example.test" };
const password = "Passphrase-For-Testing-482!";

beforeEach(() => {
  db.auth.getUser.mockResolvedValue({ data: { user: authUser }, error: null });
  db.auth.verifyOtp.mockResolvedValue({ error: null });
  db.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  db.auth.setSession.mockResolvedValue({ error: null });
});

describe("access links", () => {
  it.each(["invite", "recovery"])("consumes a %s token and removes credentials before verification", async (type) => {
    window.history.replaceState(null, "", `/?token_hash=fixture-token&type=${type}`);
    db.auth.verifyOtp.mockImplementation(async () => {
      expect(window.location.search).toBe("");
      expect(window.location.hash).toBe("");
      return { error: null };
    });
    await expect(repository.consumeAccessLink()).resolves.toEqual({ user: authUser, passwordSetup: true });
    expect(db.auth.verifyOtp).toHaveBeenCalledExactlyOnceWith({ token_hash: "fixture-token", type });
  });

  it("exchanges a PKCE recovery code and clears it from the URL", async () => {
    window.history.replaceState(null, "", "/?code=fixture-code&auth=reset");
    await expect(repository.consumeAccessLink()).resolves.toEqual({ user: authUser, passwordSetup: true });
    expect(db.auth.exchangeCodeForSession).toHaveBeenCalledExactlyOnceWith("fixture-code");
    expect(window.location.search).toBe("");
  });

  it("consumes a legacy token pair without leaving tokens in the address", async () => {
    window.history.replaceState(null, "", "/#access_token=fixture-access&refresh_token=fixture-refresh&type=invite");
    expect((await repository.consumeAccessLink()).passwordSetup).toBe(true);
    expect(db.auth.setSession).toHaveBeenCalledExactlyOnceWith({ access_token: "fixture-access", refresh_token: "fixture-refresh" });
    expect(window.location.hash).toBe("");
  });

  it.each(["/?error=access_denied&error_description=fixture", "/#access_token=incomplete&type=recovery", "/?token_hash=fixture&type=unsupported"])("rejects malformed links: %s", async (url) => {
    window.history.replaceState(null, "", url);
    await expect(repository.consumeAccessLink()).rejects.toThrow("El enlace ha caducado");
    expect(window.location.search + window.location.hash).toBe("");
    expect(db.auth.getUser).not.toHaveBeenCalled();
  });

  it("sanitizes expired links and hides provider details", async () => {
    window.history.replaceState(null, "", "/?code=used-code&auth=reset");
    db.auth.exchangeCodeForSession.mockResolvedValue({ error: { message: "sensitive provider detail" } });
    await expect(repository.consumeAccessLink()).rejects.toThrow("El enlace ha caducado");
    expect(window.location.search).toBe("");
  });

  it("does not treat a normal page with auth=reset as a recovery session", async () => {
    window.history.replaceState(null, "", "/?auth=reset");
    expect((await repository.consumeAccessLink()).passwordSetup).toBe(false);
    expect(db.auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("consumes a one-use link only once across repeated initialization", async () => {
    vi.resetModules();
    const { climagestRepository: freshRepository } = await import("@/lib/climagest");
    window.history.replaceState(null, "", "/?code=one-use-code&auth=setup");
    const first = freshRepository.initializeAuth();
    const second = freshRepository.initializeAuth();
    expect(first).toBe(second);
    await Promise.all([first, second]);
    expect(db.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });
});

describe("session and password changes", () => {
  it("returns null only for a missing session, and propagates other failures safely", async () => {
    db.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { name: "AuthSessionMissingError" } });
    await expect(repository.getSessionUser()).resolves.toBeNull();
    db.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "private detail" } });
    await expect(repository.getSessionUser()).rejects.toThrow("No se pudo recuperar la sesión.");
  });

  it("rejects weak passwords before calling Auth", async () => {
    await expect(repository.setPassword("weak")).rejects.toThrow("Al menos 15");
    expect(db.auth.updateUser).not.toHaveBeenCalled();
    expect(db.auth.signOut).not.toHaveBeenCalled();
  });

  it("requires global sign-out after a successful password change", async () => {
    db.auth.updateUser.mockResolvedValue({ error: null });
    db.auth.signOut.mockResolvedValue({ error: null });
    await repository.setPassword(password);
    expect(db.auth.updateUser).toHaveBeenCalledExactlyOnceWith({ password });
    expect(db.auth.signOut).toHaveBeenCalledExactlyOnceWith({ scope: "global" });
    expect(db.auth.updateUser.mock.invocationCallOrder[0]).toBeLessThan(db.auth.signOut.mock.invocationCallOrder[0]);
  });

  it("keeps password-update errors distinct from global sign-out errors", async () => {
    db.auth.updateUser.mockResolvedValueOnce({ error: { message: "private detail" } });
    await expect(repository.setPassword(password)).rejects.toThrow("No se pudo guardar la contraseña.");
    expect(db.auth.signOut).not.toHaveBeenCalled();
    db.auth.updateUser.mockResolvedValueOnce({ error: null });
    db.auth.signOut.mockResolvedValueOnce({ error: { message: "private detail" } });
    await expect(repository.setPassword(password)).rejects.toThrow("Contraseña guardada. Cierra la sesión");
  });

  it("trims reset addresses and uses the current origin", async () => {
    db.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    await repository.requestPasswordReset(" tech@example.test ");
    expect(db.auth.resetPasswordForEmail).toHaveBeenCalledExactlyOnceWith("tech@example.test", { redirectTo: `${window.location.origin}/?auth=reset` });
  });

  it("hides raw login errors and rejects a success without a user", async () => {
    db.auth.signInWithPassword.mockResolvedValueOnce({ data: {}, error: { message: "private detail" } });
    await expect(repository.signIn("tech@example.test", password)).rejects.toThrow("Revisa tu correo y contraseña.");
    db.auth.signInWithPassword.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(repository.signIn("tech@example.test", password)).rejects.toThrow("Supabase no devolvió un usuario autenticado.");
  });
});
