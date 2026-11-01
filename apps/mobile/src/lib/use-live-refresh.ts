import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";

const REFRESH_MS = 20_000;

export function useLiveRefresh(
  reload: (silent: boolean) => void,
  enabled = true,
) {
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const loadedOnce = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return;
      reloadRef.current(loadedOnce.current);
      loadedOnce.current = true;
      const timer = setInterval(() => reloadRef.current(true), REFRESH_MS);
      return () => clearInterval(timer);
    }, [enabled]),
  );
}
