import { useCallback, useEffect, useState } from "react";
import { getProjectAccess } from "@/lib/api";
import { errorMessage } from "@/lib/format";
import { can, type ProjectAccess } from "@/lib/permissions";

export function useProjectAccess(projectId: string) {
  const [access, setAccess] = useState<ProjectAccess | null>(null);
  const [loading, setLoading] = useState(Boolean(projectId));
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  useEffect(() => {
    // `tick` increments on reload and must be read so this effect runs again.
    if (!projectId || tick < 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getProjectAccess(projectId)
      .then((value) => {
        if (cancelled) return;
        setAccess(value);
        setError(null);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setAccess(null);
        setError(errorMessage(reason));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, tick]);

  return {
    access,
    loading,
    error,
    reload,
    allowed: (resource: string, action: string) =>
      can(access, resource, action),
  };
}
