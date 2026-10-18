import { useState } from "react";
import PixelFlowField, { type PixelFlowFieldShape } from "@/components/ui/pixel-flow-field";

const defaults = {
  text: "smooth", shape: "square" as PixelFlowFieldShape, cellSize: 8,
  gap: 3, speed: 1, pointerRadius: 130, pointerStrength: 1, weight: 800,
};

const sliders = [
  { key: "cellSize", label: "Размер пикселя", min: 3, max: 18, step: 1, unit: " px" },
  { key: "gap", label: "Промежуток", min: 0, max: 10, step: 1, unit: " px" },
  { key: "speed", label: "Скорость", min: 0, max: 3, step: 0.1, unit: "×" },
  { key: "pointerRadius", label: "Радиус курсора", min: 20, max: 300, step: 10, unit: " px" },
  { key: "pointerStrength", label: "Сила курсора", min: 0, max: 1, step: 0.05, unit: "" },
  { key: "weight", label: "Толщина букв", min: 100, max: 900, step: 100, unit: "" },
] as const;

export default function PixelFlowFieldDemo() {
  const [settings, setSettings] = useState(defaults);
  const [paused, setPaused] = useState(false);
  const [scatter, setScatter] = useState(0);
  const [open, setOpen] = useState(false);

  const reset = () => {
    setSettings({ ...defaults });
    setPaused(false);
    setScatter((value) => value + 1);
  };

  return (
    <section className="pixel-flow-demo relative h-svh min-h-[320px] w-full overflow-hidden bg-background text-foreground" aria-label="Pixel Flow Field">
      <PixelFlowField className="h-full w-full" {...settings} paused={paused} scatter={scatter} />

      <header className="pointer-events-none absolute left-6 top-6 sm:left-10 sm:top-9">
        <h1 className="text-xs font-semibold uppercase tracking-[0.2em]">Pixel Flow Field</h1>
        <p className="mt-2 max-w-48 text-xs text-neutral-500">Проведи курсором по пикселям</p>
      </header>

      <aside className="absolute right-3 top-5 z-20 w-64 sm:right-8 sm:top-7" aria-label="Настройки пиксельного поля">
        <div className="flex justify-end">
          <button type="button" aria-expanded={open} aria-controls="pixel-flow-settings" onClick={() => setOpen(!open)} className="rounded-full border border-black/10 bg-white/90 px-4 py-2 text-xs font-medium shadow-sm backdrop-blur-md">
            {open ? "Закрыть настройки" : "Настройки"}
          </button>
        </div>
        {open && (
          <div id="pixel-flow-settings" className="mt-3 max-h-[calc(100svh-10rem)] space-y-4 overflow-y-auto rounded-2xl border border-black/10 bg-white/95 p-5 shadow-lg backdrop-blur-md">
            <label className="block text-xs font-medium" htmlFor="pixel-text">Текст
              <input id="pixel-text" value={settings.text} maxLength={24} onChange={(event) => setSettings({ ...settings, text: event.target.value })} className="mt-2 block w-full rounded-lg border border-black/15 bg-neutral-50 px-3 py-2 text-sm" />
            </label>
            <label className="block text-xs font-medium" htmlFor="pixel-shape">Форма
              <select id="pixel-shape" value={settings.shape} onChange={(event) => setSettings({ ...settings, shape: event.target.value as PixelFlowFieldShape })} className="mt-2 block w-full rounded-lg border border-black/15 bg-neutral-50 px-3 py-2 text-sm">
                <option value="square">Квадраты</option>
                <option value="circle">Круги</option>
                <option value="cross">Крестики</option>
              </select>
            </label>
            {sliders.map(({ key, label, unit, ...range }) => (
              <label key={key} htmlFor={`pixel-${key}`} className="block text-xs font-medium">
                <span className="flex justify-between gap-2"><span>{label}</span><output htmlFor={`pixel-${key}`} className="font-mono text-neutral-500">{settings[key]}{unit}</output></span>
                <input id={`pixel-${key}`} type="range" {...range} value={settings[key]} onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })} className="mt-2 block w-full accent-pink-600" />
              </label>
            ))}
            <button type="button" onClick={reset} className="w-full rounded-lg border border-black/15 px-3 py-2 text-xs font-medium hover:bg-neutral-100">Сбросить настройки</button>
          </div>
        )}
      </aside>

      <div className="absolute inset-x-0 bottom-24 flex justify-center gap-2 px-16">
        <button type="button" onClick={() => setScatter((value) => value + 1)} className="rounded-full bg-neutral-900 px-5 py-2.5 text-xs font-medium text-white shadow-sm hover:bg-neutral-700">Рассыпать</button>
        <button type="button" aria-pressed={paused} onClick={() => setPaused(!paused)} className="rounded-full border border-black/15 bg-white/90 px-5 py-2.5 text-xs font-medium backdrop-blur-md hover:bg-white">{paused ? "Продолжить" : "Пауза"}</button>
      </div>
    </section>
  );
}
