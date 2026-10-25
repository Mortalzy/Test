import { useEffect, useRef, useState } from "react";
import { clothDefaults, type ClothSettings } from "@/lib/cloth-physics";
import { mountCloth, type ClothStatus } from "@/lib/cloth-interaction";
import "./cloth-demo.css";
export default function ClothDemo() {
  const [settings, setSettings] = useState<ClothSettings>(() => ({
      ...clothDefaults,
      wind: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? 0
        : clothDefaults.wind,
      quality: innerWidth < 640 ? 24 : 32,
    })),
    [panel, setPanel] = useState(false),
    [status, setStatus] = useState<ClothStatus>("closed"),
    [progress, setProgress] = useState(0),
    [message, setMessage] = useState(false),
    [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    live = useRef(settings),
    engine = useRef<ReturnType<typeof mountCloth> | null>(null);
  live.current = settings;
  useEffect(() => {
    setError("");
    try {
      engine.current = mountCloth(
        canvas.current!,
        () => live.current,
        (state, value) => {
          setStatus(state);
          setProgress(value);
        },
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось создать ткань");
    }
    return () => {
      engine.current?.dispose();
      engine.current = null;
    };
  }, [settings.quality]);
  const change = <K extends keyof ClothSettings>(
    key: K,
    value: ClothSettings[K],
  ) => setSettings((s) => ({ ...s, [key]: value }));
  const range = (
    key: "stiffness" | "flexibility" | "damping" | "wind",
    label: string,
  ) => (
    <label className="cl-range" htmlFor={`cl-${key}`} key={key}>
      <span>
        {label}
        <output>{Math.round(settings[key] * 100)}%</output>
      </span>
      <input
        type="range"
        id={`cl-${key}`}
        min="0"
        max="1"
        step=".01"
        value={settings[key]}
        onChange={(e) => change(key, Number(e.target.value))}
      />
    </label>
  );
  return (
    <section className="cl-demo" aria-label="Сайт из ткани">
      <header className="cl-header">
        <span>
          TEST <small>/ MATERIAL STUDIES 03</small>
        </span>
        <span className="cl-number">A SMALL EXPERIMENT IN FEELING</span>
      </header>
      <div className="cl-under" inert={status !== "open"}>
        <p className="cl-eyebrow">THERE IS MORE BENEATH THE SURFACE</p>
        <h1>
          Behind
          <br />
          <em>the feeling.</em>
        </h1>
        <p>
          Иногда, чтобы увидеть новое,
          <br />
          достаточно потянуть за угол.
        </p>
        <button onClick={() => setMessage(!message)}>
          {message ? "Скрыть сообщение" : "Что под поверхностью?"}{" "}
          <span>↗</span>
        </button>
        {message && (
          <p className="cl-message" role="status">
            Любопытство открывает больше, чем кажется.
          </p>
        )}
      </div>
      <canvas
        ref={canvas}
        className={`cl-canvas ${status === "open" ? "is-open" : ""}`}
        aria-label="Ткань с надписью. Потяни нижний правый угол вверх или используй кнопку Открыть."
      />
      <div className="cl-bar">
        <span className="cl-status">
          {status === "open"
            ? "ПОЛОТНО ОТКРЫТО"
            : status === "opening"
              ? "ОТКРЫВАЕМ…"
              : status === "closing"
                ? "ВОЗВРАЩАЕМ…"
                : settings.paused
                  ? "НА ПАУЗЕ"
                  : "ПОТЯНИ ЗА ОРАНЖЕВЫЙ УГОЛ"}
        </span>
        <div>
          <button
            disabled={status === "opening" || status === "closing"}
            onClick={() =>
              status === "open"
                ? engine.current?.close()
                : engine.current?.open()
            }
          >
            {status === "open" ? "↙ Вернуть полотно" : "↗ Открыть"}
          </button>
          <button
            aria-expanded={panel}
            aria-controls="cl-panel"
            onClick={() => setPanel(!panel)}
          >
            ☷ Настройки
          </button>
        </div>
      </div>
      {panel && (
        <aside className="cl-panel" id="cl-panel" aria-label="Настройки ткани">
          <div className="cl-panel-title">
            Характер материала
            <button
              onClick={() => setPanel(false)}
              aria-label="Закрыть настройки"
            >
              ×
            </button>
          </div>
          <div className="cl-presets" role="group" aria-label="Материал">
            {(["silk", "paper", "rubber"] as const).map((m, i) => (
              <button
                key={m}
                aria-pressed={settings.fabric === m}
                onClick={() => change("fabric", m)}
              >
                {["Шёлк", "Бумага", "Резина"][i]}
              </button>
            ))}
          </div>
          {range("stiffness", "Жёсткость")}
          {range("flexibility", "Гибкость")}
          {range("damping", "Затухание")}
          {range("wind", "Ветер")}
          <label className="cl-select">
            Цвет полотна
            <input
              type="color"
              value={settings.color}
              onChange={(e) => change("color", e.target.value)}
            />
          </label>
          <label className="cl-select">
            Цвет надписи
            <input
              type="color"
              value={settings.ink}
              onChange={(e) => change("ink", e.target.value)}
            />
          </label>
          <label className="cl-select">
            Качество
            <select
              value={settings.quality}
              onChange={(e) => change("quality", Number(e.target.value))}
            >
              <option value={24}>Экономное</option>
              <option value={32}>Высокое</option>
              <option value={44}>Максимальное</option>
            </select>
          </label>
          <div className="cl-actions">
            <button onClick={() => change("paused", !settings.paused)}>
              {settings.paused ? "▶ Продолжить" : "Ⅱ Пауза"}
            </button>
            <button
              onClick={() => {
                setSettings({
                  ...clothDefaults,
                  wind: matchMedia("(prefers-reduced-motion: reduce)").matches
                    ? 0
                    : clothDefaults.wind,
                  quality: innerWidth < 640 ? 24 : 32,
                });
                engine.current?.reset();
                setMessage(false);
              }}
            >
              ↺ Сбросить
            </button>
          </div>
        </aside>
      )}
      <div
        className="cl-progress"
        aria-label="Открытие полотна"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <i style={{ width: `${progress * 100}%` }} />
      </div>
      <p className="cl-hint">
        {status === "open"
          ? "Нижний экран доступен — попробуй кнопку"
          : status === "closed"
            ? "Хватай любую точку · Потяни нижний правый угол вверх и отпусти"
            : ""}
      </p>
      {error && (
        <div className="cl-error" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
