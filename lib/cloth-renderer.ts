import * as THREE from "three";
import { ClothPhysics, type ClothSettings } from "./cloth-physics";
export type ClothRect = { x: number; y: number; width: number; height: number };
export function makeClothPrint(s: ClothSettings, aspect: number) {
  const c = document.createElement("canvas");
  c.width = 1536;
  c.height = Math.round(c.width / aspect);
  const g = c.getContext("2d")!,
    w = c.width,
    h = c.height;
  g.fillStyle = s.color;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = "#00000008";
  g.lineWidth = 0.7;
  g.beginPath();
  for (let x = 0; x < w; x += 5) {
    g.moveTo(x, 0);
    g.lineTo(x, h);
  }
  for (let y = 0; y < h; y += 5) {
    g.moveTo(0, y);
    g.lineTo(w, y);
  }
  g.stroke();
  g.fillStyle = s.ink;
  g.font = "18px monospace";
  g.fillText("03 / MATERIAL STUDIES", w * 0.075, h * 0.12);
  g.textAlign = "right";
  g.fillText("TOUCH / DRAG / DISCOVER", w * 0.925, h * 0.12);
  g.textAlign = "left";
  const size = Math.min(w * 0.14, h * 0.25);
  g.font = `${size}px Georgia`;
  g.fillText("Pull to", w * 0.075, h * 0.44);
  g.font = `italic ${size}px Georgia`;
  g.fillText("discover.", w * 0.075, h * 0.44 + size);
  g.font = `${Math.max(18, w * 0.017)}px Arial`;
  g.fillText("Потяни ткань. Почувствуй форму.", w * 0.08, h * 0.81);
  g.strokeStyle = s.ink;
  g.globalAlpha = 0.4;
  g.beginPath();
  g.moveTo(w * 0.075, h * 0.86);
  g.lineTo(w * 0.68, h * 0.86);
  g.stroke();
  g.globalAlpha = 1;
  g.fillStyle = "#fa7944";
  g.beginPath();
  g.moveTo(w, h);
  g.lineTo(w - 160, h);
  g.quadraticCurveTo(w - 125, h - 125, w, h - 160);
  g.closePath();
  g.fill();
  g.fillStyle = "#28241e";
  g.textAlign = "right";
  g.font = "44px Arial";
  g.fillText("↖", w - 35, h - 42);
  return c;
}
function project(p: Float32Array, i: number, r: ClothRect) {
  return [
    r.x + (p[i] + p[i + 2] * 0.12) * r.height,
    r.y + (p[i + 1] + p[i + 2] * 0.08) * r.height,
    p[i + 2] * r.height,
  ];
}
export function createClothRenderer(
  canvas: HTMLCanvasElement,
  model: ClothPhysics,
  rect: ClothRect,
  s: ClothSettings,
) {
  const probe = document.createElement("canvas").getContext("webgl2");
  const gpu = !!probe;
  probe?.getExtension("WEBGL_lose_context")?.loseContext();
  let textureCanvas = makeClothPrint(s, model.aspect),
    settings = s,
    disposed = false;
  if (gpu) {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene(),
      camera = new THREE.OrthographicCamera(
        0,
        canvas.clientWidth,
        0,
        -canvas.clientHeight,
        0.1,
        4000,
      );
    camera.position.z = 1500;
    const geo = new THREE.BufferGeometry(),
      vertices = new Float32Array(model.positions.length),
      uv = new Float32Array((model.positions.length / 3) * 2);
    for (let y = 0; y <= model.rows; y++)
      for (let x = 0; x <= model.cols; x++) {
        const i = y * (model.cols + 1) + x;
        uv[i * 2] = x / model.cols;
        uv[i * 2 + 1] = 1 - y / model.rows;
      }
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(vertices, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    geo.setIndex(model.indices);
    const tex = new THREE.CanvasTexture(textureCanvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const material = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.82,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    scene.add(mesh, new THREE.AmbientLight(0xffffff, 1.6));
    const light = new THREE.DirectionalLight(0xffffff, 2.4);
    light.position.set(-500, 500, 900);
    scene.add(light);
    return {
      mode: "WebGL",
      draw: (next: ClothSettings) => {
        if (disposed) return;
        if (next.color !== settings.color || next.ink !== settings.ink) {
          textureCanvas = makeClothPrint(next, model.aspect);
          tex.image = textureCanvas;
          tex.needsUpdate = true;
        }
        settings = next;
        material.roughness =
          next.fabric === "rubber" ? 0.55 : next.fabric === "paper" ? 1 : 0.82;
        for (let i = 0; i < vertices.length; i += 3) {
          const [x, y, z] = project(model.positions, i, rect);
          vertices[i] = x;
          vertices[i + 1] = -y;
          vertices[i + 2] = z;
        }
        geo.attributes.position.needsUpdate = true;
        geo.computeVertexNormals();
        renderer.render(scene, camera);
      },
      dispose: () => {
        disposed = true;
        geo.dispose();
        material.dispose();
        tex.dispose();
        renderer.dispose();
      },
    };
  }
  const ctx = canvas.getContext("2d")!;
  if (!ctx) throw new Error("Canvas недоступен");
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  canvas.width = Math.round(canvas.clientWidth * dpr);
  canvas.height = Math.round(canvas.clientHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return {
    mode: "Canvas",
    draw: (next: ClothSettings) => {
      if (disposed) return;
      if (next.color !== settings.color || next.ink !== settings.ink)
        textureCanvas = makeClothPrint(next, model.aspect);
      settings = next;
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      const p = model.positions,
        indices = model.indices,
        w = textureCanvas.width,
        h = textureCanvas.height;
      // Area-weighted vertex normals keep the software lighting continuous across triangles.
      const normals = new Float32Array(p.length);
      for (let k = 0; k < indices.length; k += 3) {
        const a = indices[k] * 3,
          b = indices[k + 1] * 3,
          c = indices[k + 2] * 3,
          ux = p[b] - p[a],
          uy = p[b + 1] - p[a + 1],
          uz = p[b + 2] - p[a + 2],
          vx = p[c] - p[a],
          vy = p[c + 1] - p[a + 1],
          vz = p[c + 2] - p[a + 2],
          nx = uy * vz - uz * vy,
          ny = uz * vx - ux * vz,
          nz = ux * vy - uy * vx;
        for (const i of [a, b, c]) {
          normals[i] += nx;
          normals[i + 1] += ny;
          normals[i + 2] += nz;
        }
      }
      const shades = new Float32Array(p.length / 3);
      for (let i = 0; i < p.length; i += 3) {
        const n = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
        shades[i / 3] = Math.min(
          0.43,
          (Math.abs(normals[i] * 0.3 + normals[i + 1] * 0.4) / n) * 0.5 +
            (1 - Math.abs(normals[i + 2]) / n) * 0.18,
        );
      }
      const faces = [];
      for (let t = 0; t < indices.length; t += 3) faces.push(t);
      faces.sort(
        (a, b) =>
          p[indices[a] * 3 + 2] +
          p[indices[a + 1] * 3 + 2] +
          p[indices[a + 2] * 3 + 2] -
          (p[indices[b] * 3 + 2] +
            p[indices[b + 1] * 3 + 2] +
            p[indices[b + 2] * 3 + 2]),
      );
      for (const t of faces) {
        const ids = indices.slice(t, t + 3),
          dst = ids.map((i) => project(p, i * 3, rect)),
          src = ids.map((i) => [
            (model.rest[i * 3] / model.aspect) * w,
            model.rest[i * 3 + 1] * h,
          ]);
        const [a, b, c] = src,
          [q, r, v] = dst,
          det = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
        if (Math.abs(det) < 0.00001) continue;
        const A =
            ((r[0] - q[0]) * (c[1] - a[1]) - (v[0] - q[0]) * (b[1] - a[1])) /
            det,
          B =
            ((r[1] - q[1]) * (c[1] - a[1]) - (v[1] - q[1]) * (b[1] - a[1])) /
            det,
          C =
            ((v[0] - q[0]) * (b[0] - a[0]) - (r[0] - q[0]) * (c[0] - a[0])) /
            det,
          D =
            ((v[1] - q[1]) * (b[0] - a[0]) - (r[1] - q[1]) * (c[0] - a[0])) /
            det;
        ctx.save();
        ctx.beginPath();
        const cx = (q[0] + r[0] + v[0]) / 3,
          cy = (q[1] + r[1] + v[1]) / 3;
        for (let k = 0; k < 3; k++) {
          const x = dst[k][0],
            y = dst[k][1],
            len = Math.hypot(x - cx, y - cy) || 1;
          const ex = x + ((x - cx) / len) * 1.2,
            ey = y + ((y - cy) / len) * 1.2;
          k ? ctx.lineTo(ex, ey) : ctx.moveTo(ex, ey);
        }
        ctx.closePath();
        ctx.clip();
        ctx.transform(
          A,
          B,
          C,
          D,
          q[0] - A * a[0] - C * a[1],
          q[1] - B * a[0] - D * a[1],
        );
        ctx.drawImage(textureCanvas, 0, 0);
        ctx.restore();
        const lo = ids.reduce((a, b) => (shades[a] < shades[b] ? a : b)),
          hi = ids.reduce((a, b) => (shades[a] > shades[b] ? a : b)),
          low = project(p, lo * 3, rect),
          high = project(p, hi * 3, rect);
        const shadow = ctx.createLinearGradient(
          low[0],
          low[1],
          high[0] + 0.001,
          high[1] + 0.001,
        );
        shadow.addColorStop(0, `rgba(12,16,24,${shades[lo]})`);
        shadow.addColorStop(1, `rgba(12,16,24,${shades[hi]})`);
        ctx.fillStyle = shadow;
        ctx.beginPath();
        ctx.moveTo(q[0], q[1]);
        ctx.lineTo(r[0], r[1]);
        ctx.lineTo(v[0], v[1]);
        ctx.closePath();
        ctx.fill();
      }
    },
    dispose: () => {
      disposed = true;
    },
  };
}
