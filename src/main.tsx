import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import DemoOne from "@/components/demo"
import "./index.css"

function App() {
  return (
    <main className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-6 py-6 sm:px-10 sm:py-8">
        <a href="./" className="text-sm font-semibold tracking-[0.28em]" aria-label="Earth — главная">EARTH<span className="text-neutral-600">.</span></a>
        <span className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-500"><span className="size-1.5 rounded-full bg-neutral-400" />Interactive experiment / 001</span>
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
