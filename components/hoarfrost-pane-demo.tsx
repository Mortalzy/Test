import { useState } from "react"
import HoarfrostPane from "@/components/ui/hoarfrost-pane"

const defaults = { coverage: 0.6, brush: 46, interactive: true, seed: 11 }
const buttonClass = "rounded-full border border-white/20 bg-slate-950/70 px-4 py-2 text-xs text-white shadow-sm backdrop-blur-md hover:bg-slate-900"

export default function HoarfrostPaneDemo() {
  const [settings, setSettings] = useState(defaults)
  const [open, setOpen] = useState(false)
  const [generation, setGeneration] = useState(0)
  const reset = () => {
    setSettings({ ...defaults })
    setGeneration((value) => value + 1)
  }

  return (
    <section className="relative min-h-svh w-full bg-slate-950 text-white" aria-label="Зимнее окно">
      <HoarfrostPane key={generation} {...settings}>
        <div className="flex h-full flex-col items-center justify-center px-16 pb-10 text-center">
          <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-white/55">Night of 14 January</p>
          <h1 className="mt-4 text-5xl font-light tracking-tight text-white/90 [text-shadow:0_1px_24px_rgba(8,14,28,0.6)] sm:text-7xl">First frost</h1>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/60">Draw a finger across the glass. It freezes over again behind you.</p>
        </div>
      </HoarfrostPane>

      <aside className="absolute right-3 top-5 z-20 w-[min(17rem,calc(100vw-1.5rem))] sm:right-8 sm:top-7" aria-label="Настройки зимнего окна">
        <div className="flex justify-end">
          <button type="button" aria-expanded={open} aria-controls="frost-settings" onClick={() => setOpen(!open)} className={buttonClass}>{open ? "Закрыть настройки" : "Настройки"}</button>
        </div>
        {open && (
          <div id="frost-settings" className="mt-3 max-h-[calc(100svh-10rem)] space-y-5 overflow-y-auto rounded-2xl border border-white/15 bg-slate-950/95 p-5 shadow-xl backdrop-blur-md">
            <label htmlFor="frost-coverage" className="block text-xs">
              <span className="flex justify-between gap-3"><span>Покрытие инеем</span><output htmlFor="frost-coverage" className="font-mono text-white/60">{Math.round(settings.coverage * 100)}%</output></span>
              <input id="frost-coverage" type="range" min="0" max="1" step="0.05" value={settings.coverage} onChange={(event) => setSettings({ ...settings, coverage: Number(event.target.value) })} className="mt-3 block w-full accent-sky-200" />
            </label>
            <label htmlFor="frost-brush" className="block text-xs">
              <span className="flex justify-between gap-3"><span>Радиус кисти</span><output htmlFor="frost-brush" className="font-mono text-white/60">{settings.brush} px</output></span>
              <input id="frost-brush" type="range" min="12" max="120" step="2" value={settings.brush} onChange={(event) => setSettings({ ...settings, brush: Number(event.target.value) })} className="mt-3 block w-full accent-sky-200" />
            </label>
            <label htmlFor="frost-interactive" className="flex items-center justify-between gap-3 text-xs">
              Протирать курсором
              <input id="frost-interactive" type="checkbox" checked={settings.interactive} onChange={(event) => setSettings({ ...settings, interactive: event.target.checked })} className="size-4 accent-sky-200" />
            </label>
            <p className="text-xs leading-relaxed text-white/45">Изменение покрытия заново выращивает иней. Проводи по стеклу после появления узоров.</p>
            <button type="button" onClick={() => setSettings((value) => ({ ...value, seed: value.seed + 1 }))} className={`${buttonClass} w-full`}>Новый узор</button>
            <button type="button" onClick={reset} className={`${buttonClass} w-full`}>Сбросить настройки</button>
          </div>
        )}
      </aside>
      <div className="pointer-events-none absolute inset-x-0 bottom-24 px-16 text-center text-[11px] text-white/45">Проведи по стеклу — иней растает и появится снова</div>
    </section>
  )
}
