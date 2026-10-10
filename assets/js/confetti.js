// A short, tasteful burst of confetti for wins. Skipped when the user prefers reduced motion.

import { prefersReducedMotion } from "./dom.js";

const COLOURS = ["#f5b83d", "#ffd98a", "#f0a92b", "#ffffff", "#c9cbd3"];

export function confetti({ count = 140, duration = 1800 } = {}) {
  if (prefersReducedMotion()) return;
  const canvas = document.createElement("canvas");
  canvas.className = "confetti";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const resize = () => {
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  };
  resize();

  const pieces = Array.from({ length: count }, () => ({
    x: innerWidth * (0.2 + Math.random() * 0.6),
    y: innerHeight * 0.35 + Math.random() * 40,
    vx: (Math.random() - 0.5) * 9,
    vy: -6 - Math.random() * 8,
    size: 5 + Math.random() * 5,
    spin: (Math.random() - 0.5) * 0.3,
    angle: Math.random() * Math.PI,
    colour: COLOURS[Math.floor(Math.random() * COLOURS.length)],
  }));

  const start = performance.now();
  const frame = (now) => {
    const t = now - start;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const fade = Math.max(0, 1 - Math.max(0, t - duration * 0.6) / (duration * 0.4));
    for (const p of pieces) {
      p.vy += 0.32;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.colour;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    }
    if (t < duration) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
