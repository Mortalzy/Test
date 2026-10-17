import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import DemoOne from "@/components/demo"
import OriginalRotatingEarth from "@/components/ui/wireframe-dotted-globe-original"
import "./index.css"

function App() {
  const isOriginal = new URLSearchParams(window.location.search).get("variant") === "original"
  const variantSwitch = (
    <nav aria-label="Вариант глобуса" className="flex gap-1 rounded-full border border-white/15 bg-black p-1 text-xs">
      <a href="?variant=custom" aria-current={!isOriginal ? "page" : undefined} className={`rounded-full px-3 py-2 ${!isOriginal ? "bg-white text-black" : "text-neutral-500 hover:text-white"}`}>Вариант 1</a>
      <a href="?variant=original" aria-current={isOriginal ? "page" : undefined} className={`rounded-full px-3 py-2 ${isOriginal ? "bg-white text-black" : "text-neutral-500 hover:text-white"}`}>Оригинал 21st</a>
    </nav>
  )

  if (isOriginal) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-black p-5 text-white">
        <div className="fixed right-5 top-5 z-10">{variantSwitch}</div>
        <OriginalRotatingEarth />
      </main>
    )
  }

  return (
    <main className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-6 sm:px-10 sm:py-8">
        <a href="./" className="text-sm font-semibold tracking-[0.28em]" aria-label="Earth — главная">EARTH<span className="text-neutral-600">.</span></a>
        {variantSwitch}
      </header>
      <section className="flex flex-1 flex-col items-center justify-center px-4 pb-8" aria-label="Интерактивная модель Земли">
        <DemoOne />
      </section>
      <footer className="flex items-center justify-between gap-4 border-t border-white/10 px-6 py-5 font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-600 sm:px-10">
        <span>Wireframe & dotted globe</span>
        <a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer" className="transition-colors hover:text-neutral-300">Map data / Natural Earth ↗</a>
      </footer>
    </main>
  )
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>)
