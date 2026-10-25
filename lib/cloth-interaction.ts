import { ClothPhysics, type ClothSettings } from "./cloth-physics";
import { createClothRenderer, type ClothRect } from "./cloth-renderer";
export type ClothStatus = "closed" | "opening" | "open" | "closing";
export function mountCloth(
  canvas: HTMLCanvasElement,
  read: () => ClothSettings,
  onState: (status: ClothStatus, progress: number) => void,
) {
  let width = 0,
    height = 0,
    model: ClothPhysics,
    rect: ClothRect,
    renderer: ReturnType<typeof createClothRenderer>,
    raf = 0,
    last = 0,
    acc = 0,
    disposed = false,
    hidden = document.hidden,
    status: ClothStatus = "closed",
    amount = 0,
    progress = 0,
    report = -1,
    transitionStart: Float32Array | null = null,
    lastDrawSettings: ClothSettings | null = null,
    pid: number | null = null,
    corner = false,
    offset = [0, 0],
    wanted = [0, 0, 0];
  const release = () => {
    model?.release();
    const id = pid;
    pid = null;
    if (id !== null && canvas.hasPointerCapture(id))
      canvas.releasePointerCapture(id);
    canvas.style.cursor = "grab";
  };
  const reportState = (v: number) => {
    if (Math.abs(v - report) > 0.015 || v === 0 || v === 1) {
      report = v;
      onState(status, v);
    }
  };
  const open = () => {
    release();
    transitionStart = model.positions.slice();
    status = "opening";
    amount = 0;
    reportState(0);
  };
  const reset = () => {
    release();
    model.reset();
    lastDrawSettings = null;
    amount = 0;
    progress = 0;
    status = "closed";
    reportState(0);
  };
  const resize = () => {
    if (width === canvas.clientWidth && height === canvas.clientHeight) return;
    release();
    renderer?.dispose();
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const margin = width < 640 ? 18 : 40;
    rect = {
      x: margin,
      y: 85,
      width: width - margin * 2,
      height: Math.max(200, height - 205),
    };
    const probe = document.createElement("canvas").getContext("webgl2");
    const gpu = !!probe;
    probe?.getExtension("WEBGL_lose_context")?.loseContext();
    model = new ClothPhysics(
      Math.max(
        8,
        Math.round(
          (gpu
            ? read().quality
            : read().quality === 24
              ? 14
              : read().quality === 32
                ? 20
                : 26) * Math.min(1, rect.width / rect.height),
        ),
      ),
      rect.width / rect.height,
    );
    renderer = createClothRenderer(canvas, model, rect, read());
    reset();
  };
  const xy = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return [
      (e.clientX - r.left - rect.x) / rect.height,
      (e.clientY - r.top - rect.y) / rect.height,
    ];
  };
  const press = (e: PointerEvent) => {
    if (status !== "closed" || read().paused || pid !== null) return;
    const pos = xy(e);
    let best = -1,
      distance = Infinity;
    for (let i = model.cols + 1; i < model.positions.length / 3; i++) {
      const p = model.positions,
        z = p[i * 3 + 2],
        dx = p[i * 3] + z * 0.12 - pos[0],
        dy = p[i * 3 + 1] + z * 0.08 - pos[1],
        d = dx * dx + dy * dy;
      if (d < distance) {
        distance = d;
        best = i;
      }
    }
    if (best < 0 || Math.sqrt(distance) * rect.height > 70) return;
    pid = e.pointerId;
    canvas.setPointerCapture(pid);
    model.grip = best;
    const i = best * 3;
    offset = [model.positions[i] - pos[0], model.positions[i + 1] - pos[1]];
    wanted = [
      model.positions[i],
      model.positions[i + 1],
      model.positions[i + 2],
    ];
    model.target = [...wanted];
    corner = model.rest[i] / model.aspect > 0.8 && model.rest[i + 1] > 0.8;
    canvas.style.cursor = "grabbing";
  };
  const move = (e: PointerEvent) => {
    if (pid !== e.pointerId) return;
    const p = xy(e);
    wanted = [
      Math.max(-0.3, Math.min(model.aspect + 0.3, p[0] + offset[0])),
      Math.max(-0.1, Math.min(1.25, p[1] + offset[1])),
      0.12,
    ];
    if (corner) {
      progress = Math.max(0, Math.min(1, (1 - wanted[1]) / 0.65));
      reportState(progress);
    }
  };
  const up = (e: PointerEvent) => {
    if (pid !== e.pointerId) return;
    const finish = corner && progress > 0.58;
    release();
    progress = 0;
    if (finish) open();
    else reportState(0);
  };
  const cancel = (e: PointerEvent) => {
    if (pid === e.pointerId) {
      release();
      progress = 0;
      reportState(0);
    }
  };
  const frame = (now: number) => {
    if (disposed || hidden) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
    last = now;
    const s = read();
    if (status === "opening" || status === "closing") {
      amount += dt * 1.25;
      const t = Math.min(1, amount),
        ease = t * t * (3 - 2 * t);
      model.gather(status === "opening" ? ease : 1 - ease);
      if (status === "opening" && transitionStart) {
        for (let i = 0; i < model.positions.length; i++)
          model.positions[i] =
            transitionStart[i] * (1 - ease) + model.positions[i] * ease;
        model.previous.set(model.positions);
      }
      reportState(status === "opening" ? ease : 1 - ease);
      if (t === 1) {
        lastDrawSettings = null;
        status = status === "opening" ? "open" : "closed";
        if (status === "closed") model.reset();
        reportState(status === "open" ? 1 : 0);
      }
    } else if (status === "closed" && !s.paused) {
      acc += dt;
      let steps = 0;
      while (acc >= 1 / 120 && steps++ < 6) {
        if (model.grip >= 0) {
          for (let k = 0; k < 3; k++)
            model.target[k] += (wanted[k] - model.target[k]) * 0.18;
        }
        model.step(1 / 120, s);
        acc -= 1 / 120;
      }
    } else {
      acc = 0;
      if (s.paused && pid !== null) {
        release();
        reportState(0);
      }
    }
    if (
      (status !== "open" && !s.paused) ||
      status === "opening" ||
      status === "closing" ||
      lastDrawSettings !== s
    )
      renderer.draw(s);
    lastDrawSettings = s;
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
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  canvas.addEventListener("pointerdown", press);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", cancel);
  canvas.addEventListener("lostpointercapture", cancel);
  document.addEventListener("visibilitychange", visibility);
  if (!hidden) raf = requestAnimationFrame(frame);
  return {
    open,
    reset,
    close: () => {
      release();
      status = "closing";
      amount = 0;
      reportState(1);
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(raf);
      release();
      observer.disconnect();
      renderer.dispose();
      canvas.removeEventListener("pointerdown", press);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", cancel);
      canvas.removeEventListener("lostpointercapture", cancel);
      document.removeEventListener("visibilitychange", visibility);
    },
  };
}
