import { useEffect, useRef, useState } from "react";
import {
  gravityDefaults,
  mountGravity,
  type GravitySettings,
} from "@/lib/gravity-sandbox";
import "./gravity-sandbox.css";
export default function GravitySandboxDemo() {
  const [settings, setSettings] = useState<GravitySettings>({
      ...gravityDefaults,
    }),
    [open, setOpen] = useState(() => innerWidth >= 1000),
    [count, setCount] = useState(0),
    [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    live = useRef(settings),
    engine = useRef<ReturnType<typeof mountGravity> | null>(null),
    lastGravity = useRef(1);
  live.current = settings;
  useEffect(() => {
    try {
      engine.current = mountGravity(
        canvas.current!,
        () => live.current,
        setCount,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать сцену");
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, []);
  const update = <K extends keyof GravitySettings>(
    key: K,
    value: GravitySettings[K],
  ) => setSettings((s) => ({ ...s, [key]: value }));
  const toggleGravity = () => {
    if (settings.gravity > 0) {
      lastGravity.current = settings.gravity;
      update("gravity", 0);
    } else update("gravity", lastGravity.current);
  };
  const slider = (
    key: "gravity" | "bounce" | "friction" | "air" | "magnet" | "radius",
    label: string,
    min: number,
    max: number,
    step: number,
  ) => (
    <label className="gs-range" key={key} htmlFor={`gs-${key}`}>
      <span>
        {label}
        <output>
          {key === "radius"
            ? settings[key] + " px"
            : key === "gravity"
              ? settings[key].toFixed(1) + " g"
              : Math.round(settings[key] * (key === "air" ? 1000 : 100)) + "%"}
        </output>
      </span>
      <input
        id={`gs-${key}`}
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
      className="gs-demo"
      style={{ background: settings.background }}
      aria-label="Песочница с гравитацией"
    >
      <canvas
        ref={canvas}
        className="gs-canvas"
        aria-label="Хватай и бросай фигуры мышью или пальцем"
      />
      <header className="gs-header">
        <span>
          TEST <small>/ PLAYGROUND 02</small>
        </span>
        <span className="gs-count">{count} / 60 ОБЪЕКТОВ</span>
      </header>
      <div className="gs-title">
        <p>INTERACTIVE PHYSICS LAB</p>
        <h1>
          Play with
          <br />
          <em>gravity.</em>
        </h1>
        <p>Хватай. Бросай. Нарушай равновесие.</p>
      </div>
      <div className="gs-toolbar" role="group" aria-label="Инструменты">
        <button
          aria-pressed={settings.mode === "grab"}
          onClick={() => update("mode", "grab")}
        >
          ↖ <span>Захват</span>
        </button>
        <button
          aria-pressed={settings.mode === "attract"}
          onClick={() => update("mode", "attract")}
        >
          ⊕ <span>Магнит</span>
        </button>
        <button
          aria-pressed={settings.mode === "repel"}
          onClick={() => update("mode", "repel")}
        >
          ⊖ <span>Отталкивание</span>
        </button>
        <i />
        <button aria-pressed={settings.gravity === 0} onClick={toggleGravity}>
          ◎{" "}
          <span>
            {settings.gravity === 0 ? "Вернуть гравитацию" : "Невесомость"}
          </span>
        </button>
      </div>
      <aside className="gs-controls" aria-label="Настройки песочницы">
        <button
          className="gs-toggle"
          aria-expanded={open}
          aria-controls="gs-panel"
          onClick={() => setOpen(!open)}
        >
          ☷ Настройки <span>{open ? "−" : "+"}</span>
        </button>
        {open && (
          <div id="gs-panel" className="gs-panel">
            <div className="gs-panel-heading">
              Настрой свой мир<span>LIVE CONTROLS</span>
            </div>
            {slider("gravity", "Гравитация", 0, 2, 0.1)}
            {slider("bounce", "Упругость", 0, 0.95, 0.01)}
            {slider("friction", "Трение", 0, 1, 0.01)}
            {slider("air", "Сопротивление", 0, 0.05, 0.001)}
            <hr />
            {slider("magnet", "Сила магнита", 0, 1, 0.01)}
            {slider("radius", "Радиус магнита", 60, 400, 10)}
            <hr />
            <label className="gs-select">
              Палитра
              <select
                value={settings.palette}
                onChange={(e) =>
                  update(
                    "palette",
                    e.target.value as GravitySettings["palette"],
                  )
                }
              >
                <option value="warm">Тёплая</option>
                <option value="mono">Монохромная</option>
                <option value="candy">Пастельная</option>
              </select>
            </label>
            <label className="gs-select">
              Цвет фона
              <input
                type="color"
                value={settings.background}
                onChange={(e) => update("background", e.target.value)}
              />
            </label>
            <div className="gs-actions">
              <button
                disabled={count >= 60 || settings.paused}
                onClick={() => engine.current?.add("ball")}
              >
                + Шар
              </button>
              <button
                disabled={count >= 60 || settings.paused}
                onClick={() => engine.current?.add("block")}
              >
                + Блок
              </button>
              <button
                disabled={settings.paused}
                onClick={() => engine.current?.shake()}
              >
                ↯ Встряхнуть
              </button>
              <button onClick={() => engine.current?.calm()}>Успокоить</button>
              <button onClick={() => update("paused", !settings.paused)}>
                {settings.paused ? "▶ Продолжить" : "Ⅱ Пауза"}
              </button>
              <button
                onClick={() => {
                  setSettings({ ...gravityDefaults });
                  lastGravity.current = 1;
                  engine.current?.reset();
                }}
              >
                ↺ Сбросить
              </button>
            </div>
          </div>
        )}
      </aside>
      <p className="gs-hint" role="status">
        {settings.paused
          ? "На паузе — нажми «Продолжить» в настройках"
          : settings.mode === "grab"
            ? "Зажми фигуру и отпусти с размахом"
            : settings.mode === "attract"
              ? "Зажми свободное место — фигуры потянутся к указателю"
              : "Зажми свободное место — фигуры разлетятся от указателя"}
      </p>
      {error && (
        <div className="gs-error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
