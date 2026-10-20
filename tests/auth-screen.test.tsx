import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { LoginScreen, PasswordSetupScreen } from "@/components/auth-screen";
import { climagestRepository as repository } from "@/lib/climagest";

const password = "Passphrase-For-Testing-482!";

it("submits personal credentials and prevents duplicate login requests", async () => {
  const user = userEvent.setup();
  let finish!: () => void;
  const onLogin = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  render(<LoginScreen onLogin={onLogin} storageError="" />);
  expect((screen.getByLabelText("Correo") as HTMLInputElement).value).toBe("");
  await user.type(screen.getByLabelText("Correo"), "tech@example.test");
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  await user.click(screen.getByRole("button", { name: /Un momento/ }));
  expect(onLogin).toHaveBeenCalledExactlyOnceWith("tech@example.test", password);
  finish();
  await screen.findByRole("button", { name: "Entrar" });
});

it("shows a failed login and allows another attempt", async () => {
  const user = userEvent.setup();
  const onLogin = vi.fn().mockRejectedValue(new Error("Revisa tu correo y contraseña."));
  render(<LoginScreen onLogin={onLogin} storageError="" />);
  await user.type(screen.getByLabelText("Correo"), "tech@example.test");
  await user.type(screen.getByLabelText("Contraseña"), "incorrecta");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Revisa tu correo y contraseña.");
  expect((screen.getByRole("button", { name: "Entrar" }) as HTMLButtonElement).disabled).toBe(false);
});

it("requests recovery without logging in and displays a neutral confirmation", async () => {
  const user = userEvent.setup();
  const onLogin = vi.fn();
  const reset = vi.spyOn(repository, "requestPasswordReset").mockResolvedValue();
  render(<LoginScreen onLogin={onLogin} storageError="" />);
  await user.click(screen.getByRole("button", { name: "He olvidado mi contraseña" }));
  expect(screen.queryByLabelText("Contraseña")).toBeNull();
  await user.type(screen.getByLabelText("Correo"), "tech@example.test");
  await user.click(screen.getByRole("button", { name: /Enviar enlace/ }));
  expect((await screen.findByRole("status")).textContent).toContain("Si el correo tiene una cuenta");
  expect(reset).toHaveBeenCalledExactlyOnceWith("tech@example.test");
  expect(onLogin).not.toHaveBeenCalled();
});

it("rejects weak and mismatched passwords before saving", async () => {
  const user = userEvent.setup();
  const save = vi.spyOn(repository, "setPassword").mockResolvedValue();
  const onComplete = vi.fn();
  render(<PasswordSetupScreen onCancel={vi.fn()} onComplete={onComplete} />);
  await user.type(screen.getByLabelText("Nueva contraseña"), "onlylowercasepassword");
  await user.type(screen.getByLabelText("Repite la contraseña"), "onlylowercasepassword");
  await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
  expect(screen.getByRole("alert").textContent).toContain("Al menos 15 caracteres");
  await user.clear(screen.getByLabelText("Nueva contraseña"));
  await user.type(screen.getByLabelText("Nueva contraseña"), password);
  await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
  expect(screen.getByRole("alert").textContent).toBe("Las contraseñas no coinciden.");
  expect(save).not.toHaveBeenCalled();
  expect(onComplete).not.toHaveBeenCalled();
});

it("completes password setup only after a successful save and permits retry after failure", async () => {
  const user = userEvent.setup();
  const save = vi.spyOn(repository, "setPassword").mockRejectedValueOnce(new Error("No se pudo guardar la contraseña.")).mockResolvedValueOnce();
  const onComplete = vi.fn();
  render(<PasswordSetupScreen onCancel={vi.fn()} onComplete={onComplete} />);
  await user.type(screen.getByLabelText("Nueva contraseña"), password);
  await user.type(screen.getByLabelText("Repite la contraseña"), password);
  await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
  expect((await screen.findByRole("alert")).textContent).toContain("No se pudo guardar");
  expect(onComplete).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
  await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  expect(save).toHaveBeenLastCalledWith(password);
  expect(screen.queryByLabelText("Nueva contraseña")).toBeNull();
});
