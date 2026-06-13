"use client";
import { useEffect, useRef } from "react";

export function WaveField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function lerpColor(c1: number[], c2: number[], t: number): number[] {
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * t),
        Math.round(c1[1] + (c2[1] - c1[1]) * t),
        Math.round(c1[2] + (c2[2] - c1[2]) * t),
      ];
    }

    function triColor(t: number): number[] {
      const green  = [57,  255, 20];
      const blue   = [0,   212, 255];
      const purple = [204, 0,   255];
      t = Math.max(0, Math.min(1, t));
      if (t < 0.5) return lerpColor(green, blue,   t * 2);
      else         return lerpColor(blue,  purple,  (t - 0.5) * 2);
    }

    function draw() {
      if (!canvas) return;
      const W   = window.innerWidth;
      const H   = window.innerHeight;
      const dpr = window.devicePixelRatio || 1;

      canvas.width        = W * dpr;
      canvas.height       = H * dpr;
      canvas.style.width  = W + "px";
      canvas.style.height = H + "px";

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      ctx.fillStyle = "#030303";
      ctx.fillRect(0, 0, W, H);

      const step = 18;

      for (let x = step / 2; x < W; x += step) {
        for (let y = step / 2; y < H; y += step) {
          const wave1    = Math.sin((x / W) * Math.PI * 6   + (y / H) * Math.PI * 2.5);
          const wave2    = Math.cos((y / H) * Math.PI * 5   + (x / W) * Math.PI * 1.8);
          const wave3    = Math.sin((x / W + y / H) * Math.PI * 3);
          const combined = (wave1 + wave2 + wave3 * 0.5) / 2.5;
          const brightness = (combined + 1) / 2;
          if (brightness < 0.18) continue;

          const t   = Math.max(0, Math.min(1, (x / W) * 0.5 + ((combined + 1) / 2) * 0.5));
          const col = triColor(t);
          const r   = 1.2 * (0.4 + brightness * 0.8);

          ctx.globalAlpha = brightness * 0.55;
          ctx.fillStyle   = `rgb(${col[0]},${col[1]},${col[2]})`;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
