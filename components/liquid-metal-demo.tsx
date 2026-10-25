import { useEffect, useRef, useState } from "react";
import {
  createLiquidMetal,
  metalDefaults,
  type Metal,
  type MetalSettings,
} from "@/lib/liquid-metal";
import "./liquid-metal.css";

const materials: { id: Metal; name: string; color: string }[] = [
  { id: "chrome", name: "Хром", color: "#d1d9e2" },
  { id: "gold", name: "Золото", color: "#d7b469" },
  { id: "copper", name: "Медь", color: "#bf7d5e" },
  { id: "dark", name: "Тёмный", color: "#414956" },
];
export default function LiquidMetalDemo() {
  const [settings, setSettings] = useState<MetalSettings>(() => ({
    ...metalDefaults,
    drift: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    quality: window.innerWidth < 640 ? 256 : 512,
  }));
  const [open, setOpen] = useState(() => window.innerWidth >= 1000),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0),
    [compatible, setCompatible] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null),
    live = useRef(settings),
    engine = useRef<ReturnType<typeof createLiquidMetal> | null>(null);
  live.current = settings;
  useEffect(() => {
    setError("");
    const el = canvas.current!;
    const onError = (e: Event) => setError((e as CustomEvent<string>).detail);
    el.addEventListener("metal-error", onError);
    try {
      engine.current = createLiquidMetal(el, () => live.current);
      setCompatible(engine.current.mode === "compatible");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось запустить эффект.");
    }
    return () => {
      el.removeEventListener("metal-error", onError);
      engine.current?.dispose();
      engine.current = null;
    };
  }, [retry]);
  const update = <K extends keyof MetalSettings>(
    key: K,
    value: MetalSettings[K],
  ) => setSettings((s) => ({ ...s, [key]: value }));
  const range = (
    key: "strength" | "radius" | "speed" | "damping" | "roughness" | "light",
    label: string,
    min: number,
    max: number,
    step: number,
  ) => (
    <label className="lm-range" htmlFor={`lm-${key}`} key={key}>
      <span>
        {label}
        <output htmlFor={`lm-${key}`}>
          {key === "radius"
            ? Math.round(settings[key] * 1000)
            : Math.round(settings[key] * 100)}
          {key === "radius" ? "" : "%"}
        </output>
      </span>
      <input
        id={`lm-${key}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={settings[key]}
        onChange={(e) => update(key, Number(e.target.value))}
      />
    </label>
  );
  return (
    <section
      className="lm-demo"
      aria-label="Жидкий металл — интерактивная поверхность"
    >
      <canvas
        ref={canvas}
        className="lm-canvas"
        aria-label="Металлическая поверхность. Проведи мышью или пальцем, нажми для создания волны."
      />
      <header className="lm-header">
        <a href="?idea=metal" className="lm-brand">
          TEST<span> / EXPERIMENTS</span>
        </a>
        <span className="lm-edition">INTERACTIVE MATERIAL STUDY / 01</span>
      </header>
      <div className="lm-heading" aria-hidden={open && window.innerWidth < 640}>
        <p className="lm-eyebrow">
          <i /> DIGITAL ALCHEMY
        </p>
        <h1>
          Liquid
          <br />
          <em>matter.</em>
        </h1>
        <p className="lm-description">Металл, который чувствует движение.</p>
        <div className="lm-tags">
          <span>
            01 / {materials.find((m) => m.id === settings.material)?.name}
          </span>
          <span>{settings.paused ? "НА ПАУЗЕ" : "ИНТЕРАКТИВНЫЙ"}</span>
          {compatible && <span>CANVAS MODE</span>}
        </div>
      </div>
      <aside className="lm-controls" aria-label="Настройки жидкого металла">
        <button
          className="lm-toggle"
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls="lm-panel"
        >
          <span className="lm-toggle-icon">☷</span> Настройки{" "}
          <span>{open ? "−" : "+"}</span>
        </button>
        {open && (
          <div id="lm-panel" className="lm-panel">
            <div className="lm-panel-title">
              <span>Поверхность</span>
              <span>LIVE CONTROLS</span>
            </div>
            <fieldset className="lm-materials">
              <legend>Материал</legend>
              {materials.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  aria-pressed={settings.material === m.id}
                  onClick={() => update("material", m.id)}
                >
                  <i style={{ background: m.color }} />
                  {m.name}
                </button>
              ))}
            </fieldset>
            <div className="lm-rule" />
            {range("strength", "Сила касания", 0, 1, 0.01)}
            {range("radius", "Размер следа", 0.012, 0.1, 0.001)}
            {range("speed", "Скорость волн", 0, 1, 0.01)}
            {range("damping", "Затухание", 0, 1, 0.01)}
            <div className="lm-rule" />
            {range("roughness", "Мягкость отражений", 0, 1, 0.01)}
            {range("light", "Яркость света", 0.3, 2, 0.01)}
            <label className="lm-check">
              Фоновое движение
              <input
                type="checkbox"
                checked={settings.drift}
                onChange={(e) => update("drift", e.target.checked)}
              />
            </label>
            <label className="lm-quality" htmlFor="lm-quality">
              Качество
              <select
                id="lm-quality"
                value={settings.quality}
                onChange={(e) => update("quality", Number(e.target.value))}
              >
                <option value={256}>Экономное</option>
                <option value={512}>Высокое</option>
                <option value={768}>Максимальное</option>
              </select>
            </label>
            <div className="lm-actions">
              <button
                type="button"
                onClick={() => update("paused", !settings.paused)}
              >
                {settings.paused ? "▶ Продолжить" : "Ⅱ Пауза"}
              </button>
              <button type="button" onClick={() => engine.current?.clear()}>
                Успокоить
              </button>
            </div>
            <button
              className="lm-reset"
              type="button"
              onClick={() => {
                setSettings({
                  ...metalDefaults,
                  drift: !window.matchMedia("(prefers-reduced-motion: reduce)")
                    .matches,
                  quality: window.innerWidth < 640 ? 256 : 512,
                });
                engine.current?.clear();
              }}
            >
              ↺ Сбросить настройки
            </button>
          </div>
        )}
      </aside>
      <p className="lm-hint">
        <span>↗</span> Проведи по поверхности <b>·</b> Нажми, чтобы создать
        волну
      </p>
      {error && (
        <div className="lm-error" role="alert">
          <strong>Поверхность недоступна</strong>
          <p>{error}</p>
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Попробовать снова
          </button>
        </div>
      )}
    </section>
  );
}
