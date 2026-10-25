import type { MetalSettings } from "./liquid-metal";
/** Lower-resolution CPU renderer for browsers without floating-point WebGL. */
export function createMetalFallback(
  canvas: HTMLCanvasElement,
  read: () => MetalSettings,
) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx)
    throw new Error("Браузер не поддерживает Canvas. Попробуй другой браузер.");
  const buffer = document.createElement("canvas"),
    bc = buffer.getContext("2d", { alpha: false })!;
  let w = 1,
    h = 1,
    aspect = 1,
    quality = 0,
    field = new Float32Array(0),
    velocity = new Float32Array(0),
    next = new Float32Array(0),
    sx = new Float32Array(0),
    sy = new Float32Array(0),
    image = bc.createImageData(1, 1),
    raf = 0,
    dead = false,
    last = 0,
    acc = 0,
    time = 0,
    previous: [number, number] | null = null,
    down = false,
    pid: number | null = null,
    hidden = document.hidden;
  const impulses: {
    a: [number, number];
    b: [number, number];
    force: number;
  }[] = [];
  const base = (x: number, y: number) =>
    0.12 * Math.sin(x * 3.1 + Math.sin(y * 2.8) * 1.2) +
    0.1 * Math.sin(y * 4.4 + Math.sin(x * 2.4) * 0.9) +
    0.025 * Math.sin(x * 8 + y * 3);
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    quality = read().quality;
    aspect = r.width / Math.max(r.height, 1);
    const size = quality === 256 ? 240 : quality === 512 ? 380 : 512;
    w = Math.max(64, Math.round(size * Math.min(aspect, 1)));
    h = Math.max(64, Math.round(size / Math.max(aspect, 1)));
    canvas.width = Math.max(1, Math.round(r.width));
    canvas.height = Math.max(1, Math.round(r.height));
    buffer.width = w;
    buffer.height = h;
    image = bc.createImageData(w, h);
    field = new Float32Array(w * h);
    velocity = new Float32Array(w * h);
    next = new Float32Array(w * h);
    sx = new Float32Array(w * h);
    sy = new Float32Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const px = (x / w - 0.5) * aspect,
          py = y / h - 0.5,
          i = y * w + x,
          e = 0.003;
        sx[i] = (base(px + e, py) - base(px - e, py)) / (2 * e);
        sy[i] = (base(px, py + e) - base(px, py - e)) / (2 * e);
      }
    impulses.length = 0;
    previous = null;
    acc = 0;
  };
  const clear = () => {
    field.fill(0);
    velocity.fill(0);
    next.fill(0);
    impulses.length = 0;
    previous = null;
    acc = 0;
  };
  const xy = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  const add = (a: [number, number], b: [number, number], force: number) => {
    if (impulses.length < 48) impulses.push({ a, b, force });
  };
  const move = (e: PointerEvent) => {
    if (
      read().paused ||
      (pid !== null && pid !== e.pointerId) ||
      (e.pointerType !== "mouse" && !down)
    )
      return;
    const b = xy(e);
    if (previous)
      add(
        previous,
        b,
        Math.min(
          0.004,
          Math.hypot((b[0] - previous[0]) * aspect, b[1] - previous[1]) * 0.025,
        ) *
          (down ? 1.5 : 1) *
          read().strength,
      );
    previous = b;
  };
  const press = (e: PointerEvent) => {
    if (read().paused || pid !== null) return;
    pid = e.pointerId;
    down = true;
    previous = xy(e);
    canvas.setPointerCapture(e.pointerId);
    add(previous, previous, 0.018 * read().strength);
  };
  const release = (e: PointerEvent) => {
    if (pid !== null && pid !== e.pointerId) return;
    down = false;
    pid = null;
    previous = null;
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
  };
  const leave = () => {
    if (!down) previous = null;
  };
  const step = () => {
    const s = read(),
      coef = 0.08 + s.speed * 0.35,
      damp = 0.995 - s.damping * 0.055;
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x,
          lap =
            field[i - 1] +
            field[i + 1] +
            field[i - w] +
            field[i + w] -
            4 * field[i];
        velocity[i] = (velocity[i] + lap * coef) * damp;
        next[i] = Math.max(-0.35, Math.min(0.35, field[i] + velocity[i]));
        const edge = Math.min(x, w - x, y, h - y);
        if (edge < 6) {
          next[i] *= 0.86 + (0.14 * edge) / 6;
          velocity[i] *= 0.86 + (0.14 * edge) / 6;
        }
      }
    if (down && previous) add(previous, previous, 0.00012 * s.strength);
    for (const b of impulses.splice(0, 24)) {
      const ax = b.a[0] * aspect,
        ay = b.a[1],
        bx = b.b[0] * aspect,
        by = b.b[1],
        dx = bx - ax,
        dy = by - ay,
        len = dx * dx + dy * dy;
      const minX = Math.max(
          1,
          Math.floor(((Math.min(ax, bx) - s.radius * 2) / aspect) * w),
        ),
        maxX = Math.min(
          w - 2,
          Math.ceil(((Math.max(ax, bx) + s.radius * 2) / aspect) * w),
        ),
        minY = Math.max(1, Math.floor((Math.min(ay, by) - s.radius * 2) * h)),
        maxY = Math.min(
          h - 2,
          Math.ceil((Math.max(ay, by) + s.radius * 2) * h),
        );
      for (let y = minY; y <= maxY; y++)
        for (let x = minX; x <= maxX; x++) {
          const px = (x / w) * aspect - ax,
            py = y / h - ay,
            t = Math.max(
              0,
              Math.min(1, (px * dx + py * dy) / Math.max(len, 0.000001)),
            ),
            dist = (px - dx * t) ** 2 + (py - dy * t) ** 2;
          next[y * w + x] -=
            Math.exp(-dist / (s.radius * s.radius * 0.45)) * b.force;
        }
    }
    const old = field;
    field = next;
    next = old;
  };
  const smooth = (a: number, b: number, x: number) => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  };
  const lights = [
    [-0.55, 0.65, 1, 0, 1, 0, 0.12, 1.1],
    [0.8, 0.15, 0.7, 0, 1, 0, 0.18, 0.85],
    [0, -0.85, 0.8, 1, 0, 0, 0.08, 1.5],
  ].map(([ax, ay, az, ux, uy, uz, bw, bh]) => {
    const al = Math.hypot(ax, ay, az);
    ax /= al;
    ay /= al;
    az /= al;
    let tx = ay * uz - az * uy,
      ty = az * ux - ax * uz,
      tz = ax * uy - ay * ux;
    const tl = Math.hypot(tx, ty, tz);
    tx /= tl;
    ty /= tl;
    tz /= tl;
    return [
      ax,
      ay,
      az,
      tx,
      ty,
      tz,
      ty * az - tz * ay,
      tz * ax - tx * az,
      tx * ay - ty * ax,
      bw,
      bh,
    ];
  });
  const box = (
    rx: number,
    ry: number,
    rz: number,
    l: number[],
    blur: number,
  ) => {
    const z = rx * l[0] + ry * l[1] + rz * l[2],
      div = Math.max(z, 0.001);
    return (
      (1 -
        smooth(
          l[9],
          l[9] + blur,
          Math.abs((rx * l[3] + ry * l[4] + rz * l[5]) / div),
        )) *
      (1 -
        smooth(
          l[10],
          l[10] + blur,
          Math.abs((rx * l[6] + ry * l[7] + rz * l[8]) / div),
        )) *
      smooth(0, 0.12, z)
    );
  };
  const render = () => {
    const s = read(),
      tint =
        s.material === "gold"
          ? [1, 0.69, 0.26]
          : s.material === "copper"
            ? [1, 0.48, 0.29]
            : s.material === "dark"
              ? [0.2, 0.24, 0.3]
              : [0.91, 0.95, 1],
      blur = 0.035 + s.roughness * 0.385;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x,
          px = (x / w - 0.5) * aspect,
          py = -(y / h - 0.5),
          gx =
            (field[y * w + Math.min(w - 1, x + 1)] -
              field[y * w + Math.max(0, x - 1)]) /
            ((2 * aspect) / w),
          gy =
            (field[Math.min(h - 1, y + 1) * w + x] -
              field[Math.max(0, y - 1) * w + x]) /
            (2 / h);
        let nx = -(sx[i] + gx * 0.32 + Math.sin(py * 4 + time * 0.15) * 0.035),
          ny = sy[i] + gy * 0.32 + Math.cos(px * 3 + time * 0.12) * 0.035,
          nz = 1;
        const nl = Math.hypot(nx, ny, nz);
        nx /= nl;
        ny /= nl;
        nz /= nl;
        let vx = px * 0.5,
          vy = py * 0.5,
          vz = 1.35;
        const vl = Math.hypot(vx, vy, vz);
        vx /= vl;
        vy /= vl;
        vz /= vl;
        const d = vx * nx + vy * ny + vz * nz,
          rx = -vx + 2 * d * nx,
          ry = -vy + 2 * d * ny,
          rz = -vz + 2 * d * nz;
        const b = 0.025 + 0.055 * smooth(-0.8, 0.9, ry),
          l1 = box(rx, ry, rz, lights[0], blur),
          l2 = box(rx, ry, rz, lights[1], blur),
          l3 = box(rx, ry, rz, lights[2], blur),
          amb = 0.3 * Math.max(0, rz) ** 4,
          fresnel = (1 - Math.max(0, d)) ** 5,
          vignette =
            0.68 + 0.32 * (1 - smooth(0.1, 0.9, Math.hypot(px / aspect, py)));
        for (let c = 0; c < 3; c++) {
          let col =
            (b * [0.84, 0.91, 1][c] +
              l1 * [3.8, 4, 4.3][c] +
              l2 * [2.8, 2.65, 2.4][c] +
              l3 * [1.3, 1.5, 1.8][c] +
              amb) *
            (tint[c] * (1 - fresnel) + fresnel) *
            s.light *
            vignette;
          image.data[i * 4 + c] = 255 * (col / (1 + col)) ** (1 / 2.2);
        }
        image.data[i * 4 + 3] = 255;
      }
    bc.putImageData(image, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
  };
  const frame = (now: number) => {
    if (dead || hidden) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
    last = now;
    if (quality !== read().quality) resize();
    if (!read().paused) {
      if (read().drift) time += dt;
      acc += dt;
      let steps = 0;
      while (acc >= 1 / 120 && steps++ < 6) {
        step();
        acc -= 1 / 120;
      }
    } else {
      acc = 0;
      impulses.length = 0;
    }
    render();
    raf = requestAnimationFrame(frame);
  };
  const visibility = () => {
    hidden = document.hidden;
    last = 0;
    acc = 0;
    impulses.length = 0;
    previous = null;
    if (!hidden && !dead) raf = requestAnimationFrame(frame);
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerdown", press);
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("lostpointercapture", release);
  canvas.addEventListener("pointerleave", leave);
  document.addEventListener("visibilitychange", visibility);
  if (!hidden) raf = requestAnimationFrame(frame);
  return {
    mode: "compatible" as const,
    clear,
    dispose: () => {
      dead = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerdown", press);
      canvas.removeEventListener("pointerup", release);
      canvas.removeEventListener("pointercancel", release);
      canvas.removeEventListener("lostpointercapture", release);
      canvas.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", visibility);
      if (pid !== null && canvas.hasPointerCapture(pid))
        canvas.releasePointerCapture(pid);
    },
  };
}
