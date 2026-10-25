import Matter from "matter-js";
const { Engine, Bodies, Body, Composite, Constraint, Query, Sleeping } = Matter;
export type GravitySettings = {
  gravity: number;
  bounce: number;
  friction: number;
  air: number;
  magnet: number;
  radius: number;
  mode: "grab" | "attract" | "repel";
  background: string;
  palette: "warm" | "mono" | "candy";
  paused: boolean;
};
export const gravityDefaults: GravitySettings = {
  gravity: 1,
  bounce: 0.62,
  friction: 0.28,
  air: 0.008,
  magnet: 0.65,
  radius: 240,
  mode: "grab",
  background: "#000000",
  palette: "warm",
  paused: false,
};
export type Toy = {
  body: Matter.Body;
  kind: "ball" | "block" | "letter";
  color: number;
  radius: number;
  letter?: string;
};
export function createGravityWorld(width: number, height: number) {
  const engine = Engine.create({
      enableSleeping: true,
      positionIterations: 8,
      velocityIterations: 8,
    }),
    toys: Toy[] = [];
  let w = width,
    h = height,
    walls: Matter.Body[] = [],
    serial = 0;
  const bounds = () => {
    Composite.remove(engine.world, walls);
    walls = [
      Bodies.rectangle(w / 2, h - 76, w + 200, 40, { isStatic: true }),
      Bodies.rectangle(-30, h / 2, 90, h + 300, { isStatic: true }),
      Bodies.rectangle(w + 30, h / 2, 90, h + 300, { isStatic: true }),
      Bodies.rectangle(w / 2, 48, w + 200, 40, { isStatic: true }),
    ];
    Composite.add(engine.world, walls);
  };
  bounds();
  const add = (
    kind: "ball" | "block" | "letter",
    letter?: string,
    x?: number,
    y?: number,
  ) => {
    if (toys.length >= 60) return false;
    const size = Math.min(w < 640 ? 25 : 33, w / 15),
      r = size * (0.78 + Math.random() * 0.4),
      px = x ?? r + 35 + Math.random() * Math.max(1, w - 2 * r - 70),
      py = y ?? 110 + r;
    const options = {
      restitution: 0.62,
      friction: 0.28,
      frictionAir: 0.008,
      density: 0.002,
      slop: 0.04,
    };
    let body: Matter.Body;
    if (kind === "ball") body = Bodies.circle(px, py, r, options, 40);
    else if (kind === "block")
      body = Bodies.rectangle(px, py, r * 1.9, r * 1.9, {
        ...options,
        chamfer: { radius: 7 },
      });
    else {
      const s = r / 28,
        patterns: Record<string, number[][]> = {
          T: [
            [0, -27, 64, 15],
            [0, 5, 16, 65],
          ],
          E: [
            [-24, 0, 16, 70],
            [0, -27, 60, 16],
            [-3, 0, 52, 14],
            [0, 27, 60, 16],
          ],
          S: [
            [0, -28, 60, 15],
            [-23, -14, 15, 28],
            [0, 0, 60, 15],
            [23, 14, 15, 28],
            [0, 28, 60, 15],
          ],
        };
      const parts = (patterns[letter ?? "T"] ?? patterns.T).map(
        ([a, b, c, d]) =>
          Bodies.rectangle(px + a * s, py + b * s, c * s, d * s),
      );
      body = Body.create({ ...options, parts });
      Body.setPosition(body, { x: px, y: py });
    }
    Body.setAngle(body, (Math.random() - 0.5) * 0.7);
    const toy = { body, kind, radius: r, color: serial++ % 5, letter };
    toys.push(toy);
    Composite.add(engine.world, body);
    return true;
  };
  const resize = (nw: number, nh: number) => {
    w = nw;
    h = nh;
    bounds();
    for (const t of toys) {
      Body.setPosition(t.body, {
        x: Math.max(65, Math.min(w - 65, t.body.position.x)),
        y: Math.max(125, Math.min(h - 140, t.body.position.y)),
      });
      Sleeping.set(t.body, false);
    }
  };
  const reset = () => {
    for (const t of toys) Composite.remove(engine.world, t.body);
    toys.length = 0;
    serial = 0;
    const n = w < 640 ? 12 : 24,
      cols = w < 640 ? 4 : 8;
    const available = w > 1000 ? w - 340 : w;
    for (let i = 0; i < n; i++)
      add(
        i < 4 ? "letter" : i % 3 === 0 ? "block" : "ball",
        i < 4 ? "TEST"[i] : undefined,
        55 + (((i % cols) + 0.5) * (available - 110)) / cols,
        130 + Math.floor(i / cols) * 90,
      );
  };
  const calm = () => {
    for (const { body } of toys) {
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngularVelocity(body, 0);
    }
  };
  const shake = () => {
    for (const { body } of toys) {
      Sleeping.set(body, false);
      Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 13,
        y: -4 - Math.random() * 8,
      });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.12);
    }
  };
  reset();
  return {
    engine,
    toys,
    add,
    resize,
    reset,
    calm,
    shake,
    dispose: () => {
      Composite.clear(engine.world, false);
      Engine.clear(engine);
    },
  };
}
const palettes = {
  warm: ["#e9e6de", "#ff6b35", "#b6bec7", "#f9a66c", "#6d7785"],
  mono: ["#f1f0ea", "#a0a8b4", "#6d7480", "#c7cbd2", "#e0e2e5"],
  candy: ["#f7b5db", "#a8b8ff", "#c5eab5", "#ffc79c", "#e7dcff"],
};
export function mountGravity(
  canvas: HTMLCanvasElement,
  read: () => GravitySettings,
  onCount: (n: number) => void,
) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas недоступен в этом браузере.");
  let width = canvas.clientWidth,
    height = canvas.clientHeight,
    dpr = 1,
    raf = 0,
    last = 0,
    acc = 0,
    hidden = document.hidden,
    disposed = false,
    previousSettings = read(),
    pointer: { x: number; y: number } | null = null,
    pointerId: number | null = null,
    joint: Matter.Constraint | null = null,
    selected: Matter.Body | null = null;
  const world = createGravityWorld(width, height);
  onCount(world.toys.length);
  const release = () => {
    if (joint) Composite.remove(world.engine.world, joint);
    joint = null;
    selected = null;
    if (pointerId !== null && canvas.hasPointerCapture(pointerId))
      canvas.releasePointerCapture(pointerId);
    pointerId = null;
    pointer = null;
    canvas.style.cursor = "grab";
  };
  const xy = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const press = (e: PointerEvent) => {
    if (read().paused || pointerId !== null) return;
    pointer = xy(e);
    pointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    if (read().mode === "grab") {
      const body = Query.point(
        world.toys.map((t) => t.body),
        pointer,
      ).at(-1);
      if (body) {
        selected = body;
        Sleeping.set(body, false);
        joint = Constraint.create({
          pointA: { ...pointer },
          bodyB: body,
          pointB: {
            x: pointer.x - body.position.x,
            y: pointer.y - body.position.y,
          },
          stiffness: 0.14,
          damping: 0.15,
          length: 0,
        });
        Composite.add(world.engine.world, joint);
        canvas.style.cursor = "grabbing";
      }
    }
  };
  const move = (e: PointerEvent) => {
    if (pointerId !== e.pointerId) return;
    pointer = xy(e);
    if (joint) joint.pointA = { ...pointer };
  };
  const up = (e: PointerEvent) => {
    if (e.pointerId === pointerId) release();
  };
  const resize = () => {
    release();
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    world.resize(width, height);
  };
  const draw = () => {
    const s = read();
    ctx.fillStyle = s.background;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#ffffff08";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 24; x < width; x += 48) {
      ctx.moveTo(x, 70);
      ctx.lineTo(x, height - 97);
    }
    for (let y = 70; y < height - 97; y += 48) {
      ctx.moveTo(20, y);
      ctx.lineTo(width - 20, y);
    }
    ctx.stroke();
    ctx.fillStyle = "#ffffff40";
    ctx.fillRect(24, height - 97, width - 48, 1);
    const colors = palettes[s.palette];
    for (const t of world.toys) {
      const b = t.body,
        p = b.position,
        r = t.radius,
        color = colors[t.color];
      ctx.save();
      ctx.shadowColor = "#0009";
      ctx.shadowBlur = 12;
      ctx.shadowOffsetY = 7;
      if (t.kind === "ball") {
        const g = ctx.createRadialGradient(
          p.x - r * 0.35,
          p.y - r * 0.4,
          r * 0.02,
          p.x + r * 0.1,
          p.y + r * 0.2,
          r * 1.25,
        );
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.23, color);
        g.addColorStop(0.8, color);
        g.addColorStop(1, "#252832");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = "#ffffff35";
        ctx.stroke();
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(b.angle);
        ctx.strokeStyle = "#00000018";
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.62, r * 0.9, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        const parts = b.parts.length > 1 ? b.parts.slice(1) : [b],
          g = ctx.createLinearGradient(
            b.bounds.min.x,
            b.bounds.min.y,
            b.bounds.max.x,
            b.bounds.max.y,
          );
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.14, color);
        g.addColorStop(0.75, color);
        g.addColorStop(1, "#333843");
        ctx.fillStyle = g;
        ctx.beginPath();
        for (const part of parts) {
          part.vertices.forEach((v, i) =>
            i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y),
          );
          ctx.closePath();
        }
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        if (t.kind === "block") {
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#ffffff40";
          ctx.stroke();
        }
      }
      if (selected === b) {
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = "#ff8656";
        ctx.lineWidth = 1;
        ctx.strokeRect(
          b.bounds.min.x - 5,
          b.bounds.min.y - 5,
          b.bounds.max.x - b.bounds.min.x + 10,
          b.bounds.max.y - b.bounds.min.y + 10,
        );
      }
      ctx.restore();
    }
    if (pointer && s.mode !== "grab") {
      ctx.save();
      ctx.strokeStyle = s.mode === "attract" ? "#ff8b6280" : "#a5bfff80";
      ctx.setLineDash([4, 7]);
      ctx.beginPath();
      ctx.arc(pointer.x, pointer.y, s.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ffffffaa";
      ctx.font = "24px monospace";
      ctx.textAlign = "center";
      ctx.fillText(s.mode === "attract" ? "+" : "−", pointer.x, pointer.y + 8);
      ctx.restore();
    }
  };
  const frame = (now: number) => {
    if (disposed || hidden) return;
    const s = read();
    if (
      s.mode !== previousSettings.mode ||
      (s.paused && !previousSettings.paused)
    )
      release();
    if (s !== previousSettings) {
      world.engine.gravity.y = s.gravity;
      for (const { body } of world.toys) {
        body.restitution = s.bounce;
        body.friction = s.friction;
        body.frictionAir = s.air;
        for (const part of body.parts) {
          part.restitution = s.bounce;
          part.friction = s.friction;
        }
        if (s.gravity !== previousSettings.gravity) {
          Sleeping.set(body, false);
          if (s.gravity === 0 && previousSettings.gravity > 0)
            Body.setVelocity(body, {
              x: body.velocity.x + (Math.random() - 0.5) * 2,
              y: -2 - Math.random() * 2,
            });
        }
      }
      previousSettings = s;
    }
    const dt = last ? Math.min(now - last, 50) : 1000 / 60;
    last = now;
    if (!s.paused) {
      acc += dt;
      let steps = 0;
      while (acc >= 1000 / 120 && steps++ < 6) {
        if (pointer && s.mode !== "grab") {
          for (const { body } of world.toys) {
            const dx = pointer.x - body.position.x,
              dy = pointer.y - body.position.y,
              d = Math.hypot(dx, dy);
            if (d < s.radius && d > 1) {
              Sleeping.set(body, false);
              const f =
                (s.mode === "attract" ? 1 : -1) *
                body.mass *
                0.00065 *
                s.magnet *
                (1 - d / s.radius);
              Body.applyForce(body, body.position, {
                x: (dx / d) * f,
                y: (dy / d) * f,
              });
            }
          }
        }
        Engine.update(world.engine, 1000 / 120);
        for (const { body } of world.toys) {
          const speed = Math.hypot(body.velocity.x, body.velocity.y);
          if (speed > 24)
            Body.setVelocity(body, {
              x: (body.velocity.x / speed) * 24,
              y: (body.velocity.y / speed) * 24,
            });
          if (
            !Number.isFinite(body.position.x) ||
            !Number.isFinite(body.position.y) ||
            body.position.y > height + 200
          ) {
            Body.setPosition(body, { x: width / 2, y: 140 });
            Body.setVelocity(body, { x: 0, y: 0 });
          }
        }
        acc -= 1000 / 120;
      }
    } else acc = 0;
    draw();
    raf = requestAnimationFrame(frame);
  };
  const visibility = () => {
    hidden = document.hidden;
    cancelAnimationFrame(raf);
    last = 0;
    acc = 0;
    release();
    if (!hidden && !disposed) raf = requestAnimationFrame(frame);
  };
  canvas.addEventListener("pointerdown", press);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("lostpointercapture", up);
  document.addEventListener("visibilitychange", visibility);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  raf = requestAnimationFrame(frame);
  return {
    add: (kind: "ball" | "block") => {
      const result = world.add(kind);
      const b = world.toys.at(-1)?.body;
      if (result && b) {
        const s = read();
        b.restitution = s.bounce;
        b.friction = s.friction;
        b.frictionAir = s.air;
      }
      onCount(world.toys.length);
    },
    shake: () => {
      release();
      world.shake();
    },
    calm: () => {
      release();
      world.calm();
    },
    reset: () => {
      release();
      world.reset();
      previousSettings = { ...read(), gravity: -1 };
      onCount(world.toys.length);
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      release();
      observer.disconnect();
      canvas.removeEventListener("pointerdown", press);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("lostpointercapture", up);
      document.removeEventListener("visibilitychange", visibility);
      world.dispose();
    },
  };
}
