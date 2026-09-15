// Shared state shape returned by form Server Actions (kept out of the
// "use server" module, which may only export async functions).
export interface FormState {
  error?: string;
  ok?: boolean;
}
