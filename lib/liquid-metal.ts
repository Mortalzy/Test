import { createMetalFallback } from "./liquid-metal-fallback";
/** GPU height-field simulation. All GPU objects belong to one mounted demo. */
export type Metal = "chrome" | "gold" | "copper" | "dark";
export type MetalSettings = {
  material: Metal;
  strength: number;
  radius: number;
  speed: number;
  damping: number;
  roughness: number;
  light: number;
  drift: boolean;
  quality: number;
  paused: boolean;
};
export const metalDefaults: MetalSettings = {
  material: "chrome",
  strength: 0.65,
  radius: 0.045,
  speed: 0.65,
  damping: 0.45,
  roughness: 0.18,
  light: 1.15,
  drift: true,
  quality: 512,
  paused: false,
};
const vertex = `#version 300 es
precision highp float;
out vec2 uv;
void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));uv=p;gl_Position=vec4(p*2.-1.,0.,1.); }`;
const simulation = `#version 300 es
precision highp float;
in vec2 uv; out vec4 result;
uniform sampler2D field;
uniform vec2 texel;
uniform float aspect, speed, damping, radius;
uniform int count;
uniform vec4 strokes[24];
uniform float forces[24];
void main(){
 vec2 hv=texture(field,uv).rg;
 float lap=texture(field,uv+vec2(texel.x,0)).r+texture(field,uv-vec2(texel.x,0)).r+texture(field,uv+vec2(0,texel.y)).r+texture(field,uv-vec2(0,texel.y)).r-4.*hv.x;
 float v=(hv.y+lap*mix(.08,.43,speed))*mix(.995,.94,damping);
 float h=hv.x+v;
 for(int i=0;i<24;i++){if(i>=count) break;
  vec2 p=uv*vec2(aspect,1.), a=strokes[i].xy*vec2(aspect,1.), b=strokes[i].zw*vec2(aspect,1.);
  vec2 ab=b-a; float t=clamp(dot(p-a,ab)/max(dot(ab,ab),.000001),0.,1.);
  vec2 d=p-a-ab*t;
  h-=exp(-dot(d,d)/(radius*radius*.45))*forces[i];
 }
 // Absorb waves at the edge rather than accumulating standing waves.
 float edge=min(min(uv.x,1.-uv.x)*aspect,min(uv.y,1.-uv.y));
 float absorb=mix(.86,1.,smoothstep(0.,.06,edge));
 result=vec4(clamp(h*absorb,-.35,.35),v*absorb,0,1);
}`;
const shading = `#version 300 es
precision highp float;
in vec2 uv;out vec4 result;
uniform sampler2D field;
uniform vec2 texel;
uniform float aspect,time,roughness,light;
uniform int metal;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float base(vec2 p){p+=vec2(time*.018,-time*.012);return .12*sin(p.x*3.1+sin(p.y*2.8)*1.2)+.10*sin(p.y*4.4+sin(p.x*2.4)*.9)+.025*sin(p.x*8.+p.y*3.);}
float box(vec3 r,vec3 axis,vec3 up,vec2 size,float blur){vec3 side=normalize(cross(axis,up));up=normalize(cross(side,axis));float z=dot(r,axis);vec2 q=abs(vec2(dot(r,side),dot(r,up))/max(z,.001));vec2 b=1.-smoothstep(size,size+blur,q);return b.x*b.y*smoothstep(0.,.12,z);}
vec3 environment(vec3 r){
 float b=.025+.055*smoothstep(-.8,.9,r.y);
 vec3 c=vec3(b)*vec3(.84,.91,1.);
 float blur=mix(.035,.42,roughness);
 c+=vec3(3.8,4.,4.3)*box(r,normalize(vec3(-.55,.65,1.)),vec3(0,1,0),vec2(.12,1.1),blur);
 c+=vec3(2.8,2.65,2.4)*box(r,normalize(vec3(.8,.15,.7)),vec3(0,1,0),vec2(.18,.85),blur);
 c+=vec3(1.3,1.5,1.8)*box(r,normalize(vec3(.0,-.85,.8)),vec3(1,0,0),vec2(.08,1.5),blur);
 c+=vec3(.3)*pow(max(0.,r.z),4.);
 return c;
}
void main(){
 vec2 p=(uv-.5)*vec2(aspect,1.);float e=.003;
 vec2 slope=vec2(base(p+vec2(e,0))-base(p-vec2(e,0)),base(p+vec2(0,e))-base(p-vec2(0,e)))/(2.*e);
 slope+=vec2((texture(field,uv+vec2(texel.x,0)).r-texture(field,uv-vec2(texel.x,0)).r)/(2.*texel.x*aspect),(texture(field,uv+vec2(0,texel.y)).r-texture(field,uv-vec2(0,texel.y)).r)/(2.*texel.y))*.32;
 vec3 n=normalize(vec3(-slope,1.));vec3 view=normalize(vec3(p*.5,1.35));
 vec3 r=reflect(-view,n);
 vec3 tint=metal==1?vec3(1.,.69,.26):metal==2?vec3(1.,.48,.29):metal==3?vec3(.20,.24,.30):vec3(.91,.95,1.);
 float fresnel=pow(1.-max(dot(n,view),0.),5.);
 vec3 color=environment(r)*mix(tint,vec3(1),fresnel)*light;
 color*=mix(.68,1.,(1.-smoothstep(.1,.9,length(p/vec2(aspect,1.)))));
 color=color/(1.+color);color=pow(color,vec3(1./2.2));
 float grain=(hash(gl_FragCoord.xy)-.5)/255.;result=vec4(color+grain,1.);
}`;
type Stroke = { a: [number, number]; b: [number, number]; force: number };
export function createLiquidMetal(
  canvas: HTMLCanvasElement,
  read: () => MetalSettings,
) {
  const probe = document.createElement("canvas").getContext("webgl2");
  const supported = probe?.getExtension("EXT_color_buffer_float");
  probe?.getExtension("WEBGL_lose_context")?.loseContext();
  if (!supported) return createMetalFallback(canvas, read);
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: "high-performance",
  });
  if (!gl || !gl.getExtension("EXT_color_buffer_float"))
    throw new Error(
      "Для эффекта нужна поддержка WebGL 2 и текстур с плавающей точкой. Попробуй включить аппаратное ускорение браузера.",
    );
  const programs: WebGLProgram[] = [],
    shaders: WebGLShader[] = [];
  const compile = (type: number, source: string) => {
    const s = gl.createShader(type)!;
    shaders.push(s);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s) || "Ошибка шейдера");
    return s;
  };
  const program = (fragment: string) => {
    const p = gl.createProgram()!;
    programs.push(p);
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vertex));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(p) || "Ошибка программы");
    return p;
  };
  let sim: WebGLProgram, draw: WebGLProgram;
  try {
    sim = program(simulation);
    draw = program(shading);
  } catch (e) {
    programs.forEach((p) => gl.deleteProgram(p));
    shaders.forEach((s) => gl.deleteShader(s));
    throw e;
  }
  const locations = new Map<string, WebGLUniformLocation | null>();
  const loc = (p: WebGLProgram, n: string) => {
    const key = (p === sim ? "s" : "d") + n;
    if (!locations.has(key)) locations.set(key, gl.getUniformLocation(p, n));
    return locations.get(key)!;
  };
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  type Target = { texture: WebGLTexture; fbo: WebGLFramebuffer };
  let targets: Target[] = [],
    width = 0,
    height = 0,
    sw = 0,
    sh = 0,
    quality = 0,
    index = 0,
    raf = 0,
    dead = false,
    hidden = document.hidden,
    time = 0,
    last = 0,
    accumulator = 0;
  const strokes: Stroke[] = [];
  let pointer: [number, number] | null = null,
    down = false,
    pointerId: number | null = null;
  const releaseTargets = () => {
    targets.forEach((t) => {
      gl.deleteTexture(t.texture);
      gl.deleteFramebuffer(t.fbo);
    });
    targets = [];
  };
  const clear = () => {
    strokes.length = 0;
    pointer = null;
    for (const t of targets) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    accumulator = 0;
  };
  const resize = () => {
    const rect = canvas.getBoundingClientRect(),
      s = read();
    const dpr = Math.min(devicePixelRatio || 1, s.quality === 256 ? 1 : 1.5);
    width = Math.max(1, Math.round(rect.width * dpr));
    height = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = width;
    canvas.height = height;
    const aspect = width / height;
    sw = Math.max(64, Math.round(s.quality * Math.min(aspect, 1)));
    sh = Math.max(64, Math.round(s.quality / Math.max(aspect, 1)));
    quality = s.quality;
    releaseTargets();
    for (let i = 0; i < 2; i++) {
      const texture = gl.createTexture()!,
        fbo = gl.createFramebuffer()!;
      targets.push({ texture, fbo });
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA16F,
        sw,
        sh,
        0,
        gl.RGBA,
        gl.HALF_FLOAT,
        null,
      );
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0,
      );
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
        throw new Error(
          "Не удалось создать буфер поверхности на этом устройстве.",
        );
    }
    index = 0;
    clear();
  };
  const xy = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height];
  };
  const add = (a: [number, number], b: [number, number], force: number) => {
    if (strokes.length < 48) strokes.push({ a, b, force });
  };
  const move = (e: PointerEvent) => {
    if (
      read().paused ||
      (pointerId !== null && e.pointerId !== pointerId) ||
      (e.pointerType !== "mouse" && !down)
    )
      return;
    const b = xy(e);
    if (pointer) {
      const dist = Math.hypot(
        ((b[0] - pointer[0]) * width) / height,
        b[1] - pointer[1],
      );
      add(
        pointer,
        b,
        Math.min(0.004, dist * 0.025) * (down ? 1.5 : 1) * read().strength,
      );
    }
    pointer = b;
  };
  const press = (e: PointerEvent) => {
    if (read().paused || pointerId !== null) return;
    pointerId = e.pointerId;
    down = true;
    pointer = xy(e);
    canvas.setPointerCapture(e.pointerId);
    add(pointer, pointer, 0.018 * read().strength);
  };
  const release = (e: PointerEvent) => {
    if (pointerId !== null && pointerId !== e.pointerId) return;
    down = false;
    pointerId = null;
    pointer = null;
    if (canvas.hasPointerCapture(e.pointerId))
      canvas.releasePointerCapture(e.pointerId);
  };
  const leave = () => {
    if (!down) pointer = null;
  };
  const visibility = () => {
    hidden = document.hidden;
    last = 0;
    accumulator = 0;
    strokes.length = 0;
    pointer = null;
    if (!hidden && !dead) raf = requestAnimationFrame(frame);
  };
  const lose = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    canvas.dispatchEvent(
      new CustomEvent("metal-error", {
        detail: "Графический контекст потерян. Перезагрузи эффект.",
      }),
    );
  };
  const frame = (now: number) => {
    if (dead || hidden) return;
    const s = read();
    if (quality !== s.quality) resize();
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 1 / 60;
    last = now;
    if (!s.paused) {
      if (s.drift) time += dt;
      accumulator += dt;
      let steps = 0;
      while (accumulator >= 1 / 120 && steps++ < 6) {
        gl.useProgram(sim);
        gl.bindFramebuffer(gl.FRAMEBUFFER, targets[1 - index].fbo);
        gl.viewport(0, 0, sw, sh);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, targets[index].texture);
        gl.uniform1i(loc(sim, "field"), 0);
        gl.uniform2f(loc(sim, "texel"), 1 / sw, 1 / sh);
        gl.uniform1f(loc(sim, "aspect"), width / height);
        gl.uniform1f(loc(sim, "speed"), s.speed);
        gl.uniform1f(loc(sim, "damping"), s.damping);
        gl.uniform1f(loc(sim, "radius"), s.radius);
        if (down && pointer) add(pointer, pointer, 0.00012 * s.strength);
        const batch = strokes.splice(0, 24),
          coords = new Float32Array(96),
          forces = new Float32Array(24);
        batch.forEach((b, i) => {
          coords.set([...b.a, ...b.b], i * 4);
          forces[i] = b.force;
        });
        gl.uniform1i(loc(sim, "count"), batch.length);
        gl.uniform4fv(loc(sim, "strokes[0]"), coords);
        gl.uniform1fv(loc(sim, "forces[0]"), forces);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        index = 1 - index;
        accumulator -= 1 / 120;
      }
    } else {
      strokes.length = 0;
      accumulator = 0;
    }
    gl.useProgram(draw);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[index].texture);
    gl.uniform1i(loc(draw, "field"), 0);
    gl.uniform2f(loc(draw, "texel"), 1 / sw, 1 / sh);
    gl.uniform1f(loc(draw, "aspect"), width / height);
    gl.uniform1f(loc(draw, "time"), time);
    gl.uniform1f(loc(draw, "roughness"), s.roughness);
    gl.uniform1f(loc(draw, "light"), s.light);
    gl.uniform1i(
      loc(draw, "metal"),
      ["chrome", "gold", "copper", "dark"].indexOf(s.material),
    );
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    raf = requestAnimationFrame(frame);
  };
  try {
    resize();
  } catch (e) {
    releaseTargets();
    programs.forEach((p) => gl.deleteProgram(p));
    shaders.forEach((s) => gl.deleteShader(s));
    gl.deleteVertexArray(vao);
    throw e;
  }
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerdown", press);
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("lostpointercapture", release);
  canvas.addEventListener("pointerleave", leave);
  canvas.addEventListener("webglcontextlost", lose);
  document.addEventListener("visibilitychange", visibility);
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  if (!hidden) raf = requestAnimationFrame(frame);
  return {
    mode: "gpu" as const,
    clear,
    dispose: () => {
      dead = true;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerdown", press);
      canvas.removeEventListener("pointerup", release);
      canvas.removeEventListener("pointercancel", release);
      canvas.removeEventListener("lostpointercapture", release);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("webglcontextlost", lose);
      if (pointerId !== null && canvas.hasPointerCapture(pointerId))
        canvas.releasePointerCapture(pointerId);
      releaseTargets();
      programs.forEach((p) => gl.deleteProgram(p));
      shaders.forEach((s) => gl.deleteShader(s));
      gl.deleteVertexArray(vao);
    },
  };
}
