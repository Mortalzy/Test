export type Fabric = "silk" | "paper" | "rubber";
export type ClothSettings = {
  fabric: Fabric;
  stiffness: number;
  flexibility: number;
  damping: number;
  wind: number;
  color: string;
  ink: string;
  quality: number;
  paused: boolean;
};
export const clothDefaults: ClothSettings = {
  fabric: "silk",
  stiffness: 0.8,
  flexibility: 0.7,
  damping: 0.6,
  wind: 0.08,
  color: "#e8e2d5",
  ink: "#252723",
  quality: 32,
  paused: false,
};
type Link = {
  a: number;
  b: number;
  length: number;
  kind: number;
  lambda: number;
};
/** XPBD distance constraints: structural, shear and two-hop bending approximation. */
export class ClothPhysics {
  readonly positions: Float32Array;
  readonly previous: Float32Array;
  readonly rest: Float32Array;
  readonly links: Link[] = [];
  readonly indices: number[] = [];
  readonly cols: number;
  readonly rows: number;
  readonly aspect: number;
  grip = -1;
  target = [0, 0, 0];
  time = 0;
  constructor(cols: number, aspect: number) {
    this.cols = cols;
    this.rows = Math.max(12, Math.round(cols / aspect));
    this.aspect = aspect;
    const n = (cols + 1) * (this.rows + 1) * 3;
    this.positions = new Float32Array(n);
    this.previous = new Float32Array(n);
    this.rest = new Float32Array(n);
    for (let y = 0; y <= this.rows; y++)
      for (let x = 0; x <= cols; x++) {
        const i = (y * (cols + 1) + x) * 3;
        this.rest[i] = (x / cols) * aspect;
        this.rest[i + 1] = y / this.rows;
      }
    this.positions.set(this.rest);
    this.previous.set(this.rest);
    const link = (a: number, b: number, kind: number) =>
      this.links.push({
        a: a * 3,
        b: b * 3,
        length: Math.hypot(
          this.rest[a * 3] - this.rest[b * 3],
          this.rest[a * 3 + 1] - this.rest[b * 3 + 1],
        ),
        kind,
        lambda: 0,
      });
    for (let y = 0; y <= this.rows; y++)
      for (let x = 0; x <= cols; x++) {
        const a = y * (cols + 1) + x;
        if (x < cols) link(a, a + 1, 0);
        if (y < this.rows) link(a, a + cols + 1, 0);
        if (x < cols && y < this.rows) {
          link(a, a + cols + 2, 1);
          link(a + 1, a + cols + 1, 1);
          this.indices.push(
            a,
            a + cols + 1,
            a + 1,
            a + 1,
            a + cols + 1,
            a + cols + 2,
          );
        }
        if (x + 2 <= cols) link(a, a + 2, 2);
        if (y + 2 <= this.rows) link(a, a + 2 * (cols + 1), 2);
      }
  }
  reset() {
    this.positions.set(this.rest);
    this.previous.set(this.rest);
    this.grip = -1;
    this.time = 0;
  }
  release() {
    if (this.grip >= 0) {
      const i = this.grip * 3;
      this.previous.set(this.positions.subarray(i, i + 3), i);
    }
    this.grip = -1;
  }
  step(dt: number, s: ClothSettings) {
    this.time += dt;
    const p = this.positions,
      old = this.previous,
      top = (this.cols + 1) * 3;
    const drag = Math.exp(-(2 + s.damping * 12) * dt);
    for (let i = top; i < p.length; i += 3) {
      if (i / 3 === this.grip) continue;
      const x = p[i],
        y = p[i + 1],
        z = p[i + 2],
        wave =
          Math.sin(this.rest[i] * 5 + this.time * 1.3) *
          Math.cos(this.rest[i + 1] * 4 - this.time * 0.8);
      p[i] += (x - old[i]) * drag + (this.rest[i] - x) * 0.35 * dt * dt;
      p[i + 1] +=
        (y - old[i + 1]) * drag +
        (0.1 + (this.rest[i + 1] - y) * 0.4) * dt * dt;
      p[i + 2] +=
        (z - old[i + 2]) * drag + (s.wind * wave * 0.8 - z * 0.5) * dt * dt;
      old[i] = x;
      old[i + 1] = y;
      old[i + 2] = z;
    }
    const material =
        s.fabric === "paper" ? 0.06 : s.fabric === "rubber" ? 15 : 1,
      stretch = material * (0.0000001 + (1 - s.stiffness) * 0.000025),
      bend = s.fabric === "paper" ? 0.000003 : 0.00006 + s.flexibility * 0.008;
    for (const l of this.links) l.lambda = 0;
    for (let pass = 0; pass < 5; pass++) {
      for (const l of this.links) {
        const a = l.a,
          b = l.b,
          wa = a < top || a / 3 === this.grip ? 0 : 1,
          wb = b < top || b / 3 === this.grip ? 0 : 1;
        if (wa + wb === 0) continue;
        const dx = p[a] - p[b],
          dy = p[a + 1] - p[b + 1],
          dz = p[a + 2] - p[b + 2],
          len = Math.hypot(dx, dy, dz);
        if (len < 1e-8) continue;
        const alpha =
            (l.kind === 2 ? bend : stretch * (l.kind === 1 ? 2 : 1)) /
            (dt * dt),
          dl = (-(len - l.length) - alpha * l.lambda) / (wa + wb + alpha);
        l.lambda += dl;
        const k = dl / len;
        p[a] += wa * k * dx;
        p[a + 1] += wa * k * dy;
        p[a + 2] += wa * k * dz;
        p[b] -= wb * k * dx;
        p[b + 1] -= wb * k * dy;
        p[b + 2] -= wb * k * dz;
      }
      for (let i = 0; i < top; i++) p[i] = this.rest[i];
      for (let i = top; i < p.length; i += 3) {
        p[i] = Math.max(-0.4, Math.min(this.aspect + 0.4, p[i]));
        p[i + 1] = Math.max(-0.2, Math.min(1.4, p[i + 1]));
        p[i + 2] = Math.max(-0.02, Math.min(0.65, p[i + 2]));
      }
      if (this.grip >= 0) {
        const i = this.grip * 3;
        p[i] = this.target[0];
        p[i + 1] = this.target[1];
        p[i + 2] = this.target[2];
      }
    }
  }
  /** Art-directed gathering transition after a completed corner gesture. */
  gather(amount: number) {
    this.grip = -1;
    for (let i = 0; i < this.positions.length; i += 3) {
      const u = this.rest[i] / this.aspect,
        v = this.rest[i + 1];
      this.positions[i] =
        this.rest[i] + Math.sin(v * 11 + u * 5) * 0.025 * amount * v;
      this.positions[i + 1] = v * (1 - amount * 0.97);
      this.positions[i + 2] =
        Math.sin(v * Math.PI) * 0.25 * amount +
        Math.sin(u * 25) * 0.012 * amount * v;
    }
    this.previous.set(this.positions);
  }
}
