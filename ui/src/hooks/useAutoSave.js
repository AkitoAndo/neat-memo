import { useRef, useCallback, useEffect } from 'react';

export function useAutoSave(saveFn, delay = 2000) {
  const timerRef = useRef(null);
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  const trigger = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveFnRef.current();
    }, delay);
  }, [delay]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return trigger;
}
