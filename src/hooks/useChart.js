import { useEffect, useRef } from "react";

export function useChart(createChartFn, deps = []) {
  const canvasRef = useRef(null);
  const instanceRef = useRef(null);

  useEffect(() => {
    if (instanceRef.current) {
      instanceRef.current.destroy();
      instanceRef.current = null;
    }

    if (canvasRef.current && typeof createChartFn === "function") {
      instanceRef.current = createChartFn(canvasRef.current);
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
