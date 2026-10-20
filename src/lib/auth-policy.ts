export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_HINT = "Al menos 15 caracteres, con mayúsculas, minúsculas, números y símbolos.";

export function passwordError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_HINT;
  // Supabase Auth uses bcrypt, whose input limit is measured in bytes.
  if (new TextEncoder().encode(password).length > 72) return "La contraseña no puede superar 72 bytes. Usa menos caracteres.";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)
    || !/[!@#$%^&*()_+\-=\[\]{};:'"\\|<>?,./`~]/.test(password)) return PASSWORD_HINT;
  return null;
}
