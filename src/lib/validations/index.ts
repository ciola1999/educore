// Re-export all schemas and types
export * from './schemas';

// Helper function for form validation
export function validateForm<T>(
  schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: { errors: Array<{ path: (string | number)[]; message: string }> } } },
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data as T };
  }
  
  const errors: Record<string, string> = {};
  for (const error of result.error?.errors ?? []) {
    const path = error.path.join('.');
    errors[path] = error.message;
  }
  
  return { success: false, errors };
}
