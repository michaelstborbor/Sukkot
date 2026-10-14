import { useState } from "react";
import { api, ApiError, errorMessage } from "./api";

/** POST/PATCH a JSON body and expose field errors from the API's validation response. */
export function useSubmit() {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function submit<T>(path: string, body: unknown, method = "POST"): Promise<T | null> {
    setPending(true);
    setErrors({});
    setFormError(null);
    try {
      return await api<T>(path, { method, body });
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) setErrors(e.fields);
      setFormError(errorMessage(e));
      return null;
    } finally {
      setPending(false);
    }
  }
  return { submit, pending, errors, formError };
}
