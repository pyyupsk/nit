export async function safe<T>(
  promise: Promise<T>
): Promise<[Error, null] | [null, T]> {
  try {
    return [null, await promise];
  } catch (e) {
    return [e instanceof Error ? e : new Error(String(e)), null];
  }
}
