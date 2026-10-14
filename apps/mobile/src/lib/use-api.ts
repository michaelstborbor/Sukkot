import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { api, errorMessage } from "./api";

/** Fetch a GET endpoint whenever the screen gains focus, with pull-to-refresh support. */
export function useApi<T>(path: string | null, query?: Record<string, string | undefined>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const key = path ? `${path}?${JSON.stringify(query ?? {})}` : null;
  const latest = useRef(key);
  latest.current = key;

  const load = useCallback(
    async (mode: "initial" | "refresh" | "silent" = "initial") => {
      if (!path) {
        setLoading(false);
        return;
      }
      const requested = key;
      if (mode === "refresh") setRefreshing(true);
      try {
        const res = await api<T>(path, { query });
        if (latest.current === requested) {
          setData(res);
          setError(null);
        }
      } catch (e) {
        if (latest.current === requested) setError(errorMessage(e));
      } finally {
        if (latest.current === requested) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useFocusEffect(
    useCallback(() => {
      void load(data ? "silent" : "initial");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  return { data, setData, error, loading, refreshing, reload: () => load("refresh") };
}
