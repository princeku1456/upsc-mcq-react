import { useEffect, useRef } from "react";

export function useChart(createChartFn, deps = []) {
  const canvasRef = useRef(null);
  const instanceRef = useRef(null);
  const fnRef = useRef(createChartFn);
  fnRef.current = createChartFn;

  useEffect(() => {
    if (instanceRef.current) {
      instanceRef.current.destroy();
      instanceRef.current = null;
    }

    if (canvasRef.current && typeof fnRef.current === "function") {
      instanceRef.current = fnRef.current(canvasRef.current);
    }

    return () => {
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }
    };
  }, deps);

  return canvasRef;
}
