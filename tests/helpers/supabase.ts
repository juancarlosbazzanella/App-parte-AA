import { vi } from "vitest";

type Result = { data: unknown; error: { message: string; name?: string } | null };

export function query(data: unknown, error: Result["error"] = null) {
  return Object.assign(Promise.resolve({ data, error }), {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  });
}

export const storageMock = {
  createSignedUrls: vi.fn(),
  createSignedUrl: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
};

export const supabaseMock = {
  auth: {
    getUser: vi.fn(),
    verifyOtp: vi.fn(),
    exchangeCodeForSession: vi.fn(),
    setSession: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
  from: vi.fn<(table: string) => ReturnType<typeof query>>(),
  rpc: vi.fn<(name: string, args: unknown) => Promise<Result>>(),
  functions: { invoke: vi.fn() },
  storage: { from: vi.fn() },
};

export function resetSupabaseMock() {
  for (const mock of Object.values(supabaseMock.auth)) mock.mockReset();
  for (const mock of Object.values(storageMock)) mock.mockReset();
  supabaseMock.from.mockReset().mockImplementation((table) => {
    throw new Error(`Unexpected table in test: ${table}`);
  });
  supabaseMock.rpc.mockReset().mockImplementation(async (name) => {
    throw new Error(`Unexpected RPC in test: ${name}`);
  });
  supabaseMock.functions.invoke.mockReset();
  supabaseMock.storage.from.mockReset().mockReturnValue(storageMock);
  storageMock.upload.mockResolvedValue({ data: {}, error: null });
  storageMock.remove.mockResolvedValue({ data: [], error: null });
}
