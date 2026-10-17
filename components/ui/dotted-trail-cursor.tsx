// Built using Hyperiux Vault: https://vault.hyperiux.com

"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQueryList.addEventListener("change", callback);
  return () => mediaQueryList.removeEventListener("change", callback);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ?? false;
}

function getServerReducedMotionSnapshot(): boolean {
  return false;
}

// Safe during render - returns false on the server.
function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot
  );
}

// Shader array size, the cap for trailLength
const TRAIL_LENGTH = 48;
// Active nodes by default
const TRAIL_NODES = 18;
const DOT_SPACING = 34;
const DOT_RADIUS = 1.2;
const GLOW_RADIUS = 300;
const HEAD_RADIUS = 80;
const FOLLOW_EASE = 0.22;
const TRAIL_EASE = 0.45;
// Softens segment weighting
const WEIGHT_SOFTEN = 400.0;
// Newer strokes win
const STACK_BIAS = 8.0;
// Floor for old segments
const STACK_FLOOR = 0.02;
// Tail-to-blob rounding
const JOIN_SOFTNESS = 0.55;
// Soft edge band
const EDGE_INNER = 0.9;
const EDGE_OUTER = 0.95;
// Lifts the interior
const EDGE_GAMMA = 0.75;
// Blend start inside
const RIM_INNER = 2.1;
// Blend end outside
const RIM_OUTER = 1.5;
// Edge pulled to colorA
const EDGE_DESATURATE = 0.3;
// Desaturation band width
const EDGE_DESATURATE_SPAN = 2.1;
// Tail drift to colorB
const TAIL_TILT = 0.18;
// Drift build-up range
const TILT_START = 0.01;
const TILT_END = 0.92;

const COLOR_A = "#ff4fd8";
const COLOR_B = "#8b5cf6";
// Fade when cursor rests
const FADE_ON_IDLE = true;
// Stillness before fading, ms
const IDLE_DELAY = 100;
// Idle fade duration, ms
const IDLE_FADE = 1100;

// Theme tokens used when a surface color is left unset. The class names are
// spelled out in full so Tailwind generates them; the hex values are used
// only when the project has no such tokens.
const THEME_BACKGROUND = { className: "text-background", fallback: "#ffffff" };
const THEME_DOT = { className: "text-foreground/20", fallback: "#d1d1d1" };
const THEME_ACTIVE_DOT = { className: "text-background", fallback: "#ffffff" };

// Inherited by the colour probe, so an unresolved token is detectable
const PROBE_SENTINEL = "rgb(1, 2, 3)";

const VERTEX_SHADER = `#version 300 es
in vec2 aQuad;
void main() {
	gl_Position = vec4(aQuad, 0.0, 1.0);
}`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform vec2 uTrail[${TRAIL_LENGTH}];
uniform float uPresence;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uBackground;
uniform vec3 uDotColor;
uniform vec3 uActiveDotColor;
uniform float uSpacing;
uniform float uDotRadius;
uniform float uGlowRadius;
uniform float uHeadRadius;
uniform int uTrailNodes;
uniform float uRimInner;
uniform float uRimOuter;
uniform float uEdgeDesaturate;
uniform float uEdgeDesaturateSpan;
uniform float uTailTilt;

out vec4 outColor;

// Point to segment distance
float distanceToSegment(vec2 point, vec2 a, vec2 b) {
	vec2 ab = b - a;
	float lengthSquared = dot(ab, ab);
	float t = lengthSquared > 0.0001 ? clamp(dot(point - a, ab) / lengthSquared, 0.0, 1.0) : 0.0;
	return distance(point, a + ab * t);
}

// Rounded field union
float smoothMin(float a, float b, float softness) {
	float h = clamp(0.5 + 0.5 * (b - a) / softness, 0.0, 1.0);
	return mix(b, a, h) - softness * h * (1.0 - h);
}

void main() {
	vec2 fragment = gl_FragCoord.xy;

	// Ribbon distance field
	float ribbonField = 1e9;
	float tintHead = 0.0;
	float tintWeight = 0.0;

	int lastSegment = uTrailNodes - 1;
	for (int i = 0; i < ${TRAIL_LENGTH - 1}; i++) {
		if (i >= lastSegment) break;
		float head = float(i) / float(lastSegment);
		float segment = distanceToSegment(fragment, uTrail[i], uTrail[i + 1]);

		// Fat head, thin tail
		float thickness = uHeadRadius * mix(0.32, 1.0, pow(1.0 - head, 1.1));
		ribbonField = min(ribbonField, segment - thickness);

		float strength = 1.0 - smoothstep(thickness, thickness + uHeadRadius * 0.9, segment);

		// Recency weighting
		float recency = ${STACK_FLOOR.toFixed(2)} + pow(1.0 - head, ${STACK_BIAS.toFixed(1)});
		float weight = strength * strength * recency / (segment * segment + ${WEIGHT_SOFTEN.toFixed(1)});
		tintHead += head * weight;
		tintWeight += weight;
	}

	// Position along trail
	float blendedHead = tintWeight > 0.0 ? tintHead / tintWeight : 0.0;

	float headDistance = distance(fragment, uTrail[0]);
	float blobField = headDistance - uHeadRadius;
	float bloom = (1.0 - smoothstep(0.0, uGlowRadius, headDistance)) * uPresence;

	// Head + tail silhouette
	float bodyField = smoothMin(ribbonField, blobField, uHeadRadius * ${JOIN_SOFTNESS.toFixed(2)});
	float bodyEdge = 1.0 - smoothstep(-uHeadRadius * ${EDGE_INNER.toFixed(2)}, uHeadRadius * ${EDGE_OUTER.toFixed(2)}, bodyField);
	float body = pow(bodyEdge, ${EDGE_GAMMA.toFixed(2)}) * uPresence;

	// Flat colour at blob
	float headLock = 1.0 - smoothstep(uHeadRadius * 0.10, uHeadRadius * 1.1, headDistance);
	float tilt = clamp((blendedHead - ${TILT_START.toFixed(2)}) / ${(TILT_END - TILT_START).toFixed(2)}, 0.0, 1.0);
	float gradient = tilt * uTailTilt * (1.0 - headLock);

	// Radial core-to-edge ramp
	float rim = smoothstep(-uHeadRadius * uRimInner, uHeadRadius * uRimOuter, bodyField);
	float blend = clamp(gradient + rim, 0.0, 1.0);

	float ink = clamp(body + pow(bloom, 2.0) * 0.8, 0.0, 1.0);

	// Edge fades to colorA
	float edgeFade = 1.0 - smoothstep(-uHeadRadius * uEdgeDesaturateSpan, uHeadRadius * uEdgeDesaturateSpan, bodyField);
	vec3 tint = mix(uColorA, uColorB, blend * mix(uEdgeDesaturate, 1.0, edgeFade));

	vec3 color = mix(uBackground, tint, ink);

	// Dots punched as holes
	vec2 cell = mod(fragment, uSpacing) - uSpacing * 0.5;
	float dotSize = uDotRadius * (1.0 + ink * 1.8);
	float dot = 1.0 - smoothstep(dotSize - 0.9, dotSize + 0.9, length(cell));

	vec3 dotColor = mix(uDotColor, uActiveDotColor, ink);

	color = mix(color, dotColor, dot);

	outColor = vec4(color, 1.0);
}`;

type Rgb = [number, number, number];

interface ResolvedColors {
  colorA: Rgb;
  colorB: Rgb;
  background: Rgb;
  dot: Rgb;
  activeDot: Rgb;
}

// Paints a CSS colour over a backdrop and reads the pixel back as 0-1 RGB.
// Handles any syntax the browser parses (hex, rgb, oklch, oklab, color()).
function paintColor(
  context: CanvasRenderingContext2D,
  color: string,
  fallback: string,
  backdrop: Rgb | null
): Rgb {
  context.clearRect(0, 0, 1, 1);
  if (backdrop) {
    context.fillStyle = `rgb(${backdrop.map((c) => Math.round(c * 255)).join(",")})`;
    context.fillRect(0, 0, 1, 1);
  }
  // Unparseable colours leave the fallback in place
  context.fillStyle = fallback;
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

export interface DottedTrailCursorProps {
  /** Core color at the cursor. Any CSS color. */
  colorA?: string;
  /** Outer color the blend runs toward. Any CSS color. */
  colorB?: string;
  /** Page color behind the grid. Defaults to the theme's background token. */
  backgroundColor?: string;
  /** Dot color at rest. Defaults to the theme's foreground at 20% over the background. */
  dotColor?: string;
  /** Dot color under the trail. Defaults to the theme's background token, so dots read as holes. */
  activeDotColor?: string;
  /** Distance between dots in the grid, px. */
  dotSpacing?: number;
  /** Radius of an idle dot, px. */
  dotRadius?: number;
  /** Reach of the soft glow around the cursor, px. */
  glowRadius?: number;
  /** Radius of the blob at the cursor, px. */
  headRadius?: number;
  /** How quickly the trail chases the cursor, 0.02-1. */
  followSpeed?: number;
  /** How many nodes the tail trails behind, 2-48. */
  trailLength?: number;
  /** Fade the trail out when the cursor rests. */
  fadeOnIdle?: boolean;
  /** Stillness before the idle fade starts, ms. */
  idleDelay?: number;
  /** How long the idle fade takes, ms. */
  idleFade?: number;
  /** Where the color blend starts, inside the shape (in head radii). */
  rimInner?: number;
  /** Where the color blend finishes, past the edge (in head radii). */
  rimOuter?: number;
  /** Pulls the fading edge back toward colorA, 0-1. */
  edgeDesaturate?: number;
  /** Band width that desaturation acts over (in head radii). */
  edgeDesaturateSpan?: number;
  /** Extra drift toward colorB along the tail, 0-1. */
  tailTilt?: number;
  className?: string;
  /** Content rendered above the grid. */
  children?: ReactNode;
}

export default function DottedTrailCursor({
  colorA = COLOR_A,
  colorB = COLOR_B,
  backgroundColor,
  dotColor,
  activeDotColor,
  dotSpacing = DOT_SPACING,
  dotRadius = DOT_RADIUS,
  glowRadius = GLOW_RADIUS,
  headRadius = HEAD_RADIUS,
  followSpeed = FOLLOW_EASE,
  trailLength = TRAIL_NODES,
  fadeOnIdle = FADE_ON_IDLE,
  idleDelay = IDLE_DELAY,
  idleFade = IDLE_FADE,
  rimInner = RIM_INNER,
  rimOuter = RIM_OUTER,
  edgeDesaturate = EDGE_DESATURATE,
  edgeDesaturateSpan = EDGE_DESATURATE_SPAN,
  tailTilt = TAIL_TILT,
  className = "",
  children,
}: DottedTrailCursorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const paletteCanvasRef = useRef<CanvasRenderingContext2D | null>(null);
  const colorsRef = useRef<ResolvedColors | null>(null);
  // Set by the render effect; redraws when nothing else will
  const requestDrawRef = useRef<() => void>(() => {});
  const settingsRef = useRef({
    colorA,
    colorB,
    backgroundColor,
    dotColor,
    activeDotColor,
    dotSpacing,
    dotRadius,
    glowRadius,
    headRadius,
    followSpeed,
    trailLength,
    fadeOnIdle,
    idleDelay,
    idleFade,
    rimInner,
    rimOuter,
    edgeDesaturate,
    edgeDesaturateSpan,
    tailTilt,
  });
  const reducedMotion = usePrefersReducedMotion();
  const [renderError, setRenderError] = useState<string | null>(null);

  settingsRef.current = {
    colorA,
    colorB,
    backgroundColor,
    dotColor,
    activeDotColor,
    dotSpacing,
    dotRadius,
    glowRadius,
    headRadius,
    followSpeed,
    trailLength,
    fadeOnIdle,
    idleDelay,
    idleFade,
    rimInner,
    rimOuter,
    edgeDesaturate,
    edgeDesaturateSpan,
    tailTilt,
  };

  // Resolves every colour prop (or its theme token) to RGB for the shader
  const resolveColorsRef = useRef(() => {
    const probe = probeRef.current;
    if (!probe) return;

    if (!paletteCanvasRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      paletteCanvasRef.current = canvas.getContext("2d", {
        willReadFrequently: true,
      });
    }
    const context = paletteCanvasRef.current;
    if (!context) return;

    const settings = settingsRef.current;

    const resolve = (
      value: string | undefined,
      theme: { className: string; fallback: string } | null,
      fallback: string,
      backdrop: Rgb | null
    ) => {
      // Explicit values go through the probe so var() and color-mix() resolve
      probe.className = value ? "" : theme?.className ?? "";
      probe.style.color = value ?? "";
      const computed = getComputedStyle(probe).color;
      const css = computed && computed !== PROBE_SENTINEL ? computed : fallback;
      return paintColor(context, css, fallback, backdrop);
    };

    const background = resolve(
      settings.backgroundColor,
      THEME_BACKGROUND,
      THEME_BACKGROUND.fallback,
      [1, 1, 1]
    );

    colorsRef.current = {
      colorA: resolve(settings.colorA, null, COLOR_A, background),
      colorB: resolve(settings.colorB, null, COLOR_B, background),
      background,
      dot: resolve(settings.dotColor, THEME_DOT, THEME_DOT.fallback, background),
      activeDot: resolve(
        settings.activeDotColor,
        THEME_ACTIVE_DOT,
        THEME_ACTIVE_DOT.fallback,
        background
      ),
    };
  });

  // Props may have changed colours
  useEffect(() => {
    resolveColorsRef.current();
    requestDrawRef.current();
  });

  // Follow light/dark switches on the page
  useEffect(() => {
    const refresh = () => {
      resolveColorsRef.current();
      requestDrawRef.current();
    };

    const observer = new MutationObserver(refresh);
    const attributeFilter = ["class", "style", "data-theme", "data-mode"];
    observer.observe(document.documentElement, { attributes: true, attributeFilter });
    observer.observe(document.body, { attributes: true, attributeFilter });

    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", refresh);

    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", refresh);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
    if (!gl) {
      setRenderError("Для цветного следа требуется WebGL 2. Проверьте аппаратное ускорение браузера.");
      return;
    }

    const vertexShader = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) {
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
      setRenderError("Браузер не смог запустить эффект цветного следа.");
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      setRenderError("Не удалось создать графический эффект.");
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      setRenderError("Браузер не смог запустить эффект цветного следа.");
      return;
    }

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );

    const quadLocation = gl.getAttribLocation(program, "aQuad");
    gl.enableVertexAttribArray(quadLocation);
    gl.vertexAttribPointer(quadLocation, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      resolution: gl.getUniformLocation(program, "uResolution"),
      trail: gl.getUniformLocation(program, "uTrail"),
      presence: gl.getUniformLocation(program, "uPresence"),
      colorA: gl.getUniformLocation(program, "uColorA"),
      colorB: gl.getUniformLocation(program, "uColorB"),
      background: gl.getUniformLocation(program, "uBackground"),
      dotColor: gl.getUniformLocation(program, "uDotColor"),
      activeDotColor: gl.getUniformLocation(program, "uActiveDotColor"),
      spacing: gl.getUniformLocation(program, "uSpacing"),
      dotRadius: gl.getUniformLocation(program, "uDotRadius"),
      glowRadius: gl.getUniformLocation(program, "uGlowRadius"),
      headRadius: gl.getUniformLocation(program, "uHeadRadius"),
      trailNodes: gl.getUniformLocation(program, "uTrailNodes"),
      rimInner: gl.getUniformLocation(program, "uRimInner"),
      rimOuter: gl.getUniformLocation(program, "uRimOuter"),
      edgeDesaturate: gl.getUniformLocation(program, "uEdgeDesaturate"),
      edgeDesaturateSpan: gl.getUniformLocation(program, "uEdgeDesaturateSpan"),
      tailTilt: gl.getUniformLocation(program, "uTailTilt"),
    };

    const trail = new Float32Array(TRAIL_LENGTH * 2);
    const pointer = { x: 0, y: 0 };
    const eased = { x: 0, y: 0 };
    let presence = 0;
    let targetPresence = 0;
    let seeded = false;
    let pixelRatio = 1;
    let frame = 0;
    let lastMoved = 0;
    let pointerInside = false;
    let visible = true;

    // Clamped to the shader array size
    const activeNodes = () =>
      Math.max(
        2,
        Math.min(Math.round(settingsRef.current.trailLength), TRAIL_LENGTH)
      );

    // Live props each frame
    const pushUniforms = () => {
      const settings = settingsRef.current;
      if (!colorsRef.current) resolveColorsRef.current();
      const colors = colorsRef.current;

      if (colors) {
        gl.uniform3fv(uniforms.colorA, colors.colorA);
        gl.uniform3fv(uniforms.colorB, colors.colorB);
        gl.uniform3fv(uniforms.background, colors.background);
        gl.uniform3fv(uniforms.dotColor, colors.dot);
        gl.uniform3fv(uniforms.activeDotColor, colors.activeDot);
      }
      gl.uniform1f(uniforms.spacing, settings.dotSpacing * pixelRatio);
      gl.uniform1f(uniforms.dotRadius, settings.dotRadius * pixelRatio);
      gl.uniform1f(uniforms.glowRadius, settings.glowRadius * pixelRatio);
      gl.uniform1f(uniforms.headRadius, settings.headRadius * pixelRatio);
      gl.uniform1i(uniforms.trailNodes, activeNodes());
      gl.uniform1f(uniforms.rimInner, settings.rimInner);
      gl.uniform1f(uniforms.rimOuter, settings.rimOuter);
      gl.uniform1f(uniforms.edgeDesaturate, settings.edgeDesaturate);
      gl.uniform1f(uniforms.edgeDesaturateSpan, settings.edgeDesaturateSpan);
      gl.uniform1f(uniforms.tailTilt, settings.tailTilt);
    };

    const resize = () => {
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = container.getBoundingClientRect();

      canvas.width = Math.max(1, Math.round(width * pixelRatio));
      canvas.height = Math.max(1, Math.round(height * pixelRatio));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    };

    const seed = (x: number, y: number) => {
      for (let i = 0; i < TRAIL_LENGTH; i++) {
        trail[i * 2] = x;
        trail[i * 2 + 1] = y;
      }
      eased.x = x;
      eased.y = y;
      seeded = true;
    };

    const handlePointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      // Flip Y for gl_FragCoord
      const x = (event.clientX - rect.left) * pixelRatio;
      const y = (rect.bottom - event.clientY) * pixelRatio;

      // Only real movement counts
      if (x !== pointer.x || y !== pointer.y) lastMoved = performance.now();

      pointer.x = x;
      pointer.y = y;
      pointerInside = true;
      targetPresence = 1;

      if (!seeded) seed(pointer.x, pointer.y);
    };

    const handlePointerLeave = () => {
      pointerInside = false;
      targetPresence = 0;
    };

    // Static dot field, one draw
    const drawStill = () => {
      gl.uniform2fv(uniforms.trail, trail);
      gl.uniform1f(uniforms.presence, 0);
      pushUniforms();
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const render = () => {
      // Paused while scrolled out of view
      if (!visible) {
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(render);

      const settings = settingsRef.current;
      const followEase = Math.min(Math.max(settings.followSpeed, 0.02), 1);

      // Ramped fade once still
      let idleFadeAmount = 0.0;
      if (settings.fadeOnIdle && pointerInside && lastMoved > 0) {
        const still =
          performance.now() - lastMoved - Math.max(0, settings.idleDelay);
        const span = Math.max(1, settings.idleFade);
        const x = Math.min(Math.max(still / span, 0), 1);
        // Smootherstep, soft both ends
        idleFadeAmount = x * x * x * (x * (x * 6 - 15) + 10);
      }

      presence += (targetPresence - presence) * 0.08;
      presence = Math.min(presence, 1 - idleFadeAmount);
      eased.x += (pointer.x - eased.x) * followEase;
      eased.y += (pointer.y - eased.y) * followEase;

      trail[0] = eased.x;
      trail[1] = eased.y;

      const nodes = activeNodes();
      for (let i = 1; i < nodes; i++) {
        const index = i * 2;
        const previous = (i - 1) * 2;
        trail[index] += (trail[previous] - trail[index]) * TRAIL_EASE;
        trail[index + 1] +=
          (trail[previous + 1] - trail[index + 1]) * TRAIL_EASE;
      }

      // Park dormant nodes on the tail tip
      const tipX = trail[(nodes - 1) * 2];
      const tipY = trail[(nodes - 1) * 2 + 1];
      for (let i = nodes; i < TRAIL_LENGTH; i++) {
        trail[i * 2] = tipX;
        trail[i * 2 + 1] = tipY;
      }

      gl.uniform2fv(uniforms.trail, trail);
      gl.uniform1f(uniforms.presence, presence);
      pushUniforms();

      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const cleanupGl = () => {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteBuffer(buffer);
    };

    if (reducedMotion) {
      const observer = new ResizeObserver(() => {
        resize();
        drawStill();
      });
      observer.observe(container);
      resize();
      drawStill();
      requestDrawRef.current = drawStill;

      return () => {
        requestDrawRef.current = () => {};
        observer.disconnect();
        cleanupGl();
      };
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    const visibilityObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && frame === 0) frame = requestAnimationFrame(render);
    });
    visibilityObserver.observe(container);

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    container.addEventListener("pointerleave", handlePointerLeave);
    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      container.removeEventListener("pointerleave", handlePointerLeave);
      cleanupGl();
    };
  }, [reducedMotion]);

  return (
    <div
      ref={containerRef}
      // Runtime colour when set; theme token otherwise
      style={{
        backgroundColor,
        backgroundImage: `radial-gradient(circle, ${dotColor ?? "#d1d1d1"} ${dotRadius}px, transparent ${dotRadius + 0.5}px)`,
        backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
        touchAction: "none",
      }}
      className={`relative h-screen w-full overflow-hidden ${backgroundColor ? "" : "bg-background"} ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className={`absolute inset-0 h-full w-full ${renderError ? "hidden" : ""}`}
      />
      <span aria-hidden="true" hidden style={{ color: PROBE_SENTINEL }}>
        <span ref={probeRef} />
      </span>
      <div className="relative z-10 h-full w-full">{children}</div>
      {renderError && (
        <p role="status" className="pointer-events-none absolute inset-x-16 top-6 z-20 text-center text-xs text-neutral-500">{renderError}</p>
      )}
    </div>
  );
}
