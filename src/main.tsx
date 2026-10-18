import { StrictMode, useCallback, useEffect, useState } from "react"
import { createRoot } from "react-dom/client"
import DemoOne from "@/components/demo"
import DottedTrailDemo from "@/components/dotted-trail-demo"
import PixelFlowFieldDemo from "@/components/pixel-flow-field-demo"
import KineticGridDemo from "@/components/kinetic-grid-demo"
import OriginalRotatingEarth from "@/components/ui/wireframe-dotted-globe-original"
import { ideaIndexFromSearch, ideas, nextIdeaIndex } from "@/lib/ideas"
import "./index.css"

function App() {
  const [activeIndex, setActiveIndex] = useState(() => ideaIndexFromSearch(window.location.search))
  const idea = ideas[activeIndex]

  const navigate = useCallback((direction: number) => {
    const next = nextIdeaIndex(activeIndex, direction)
    const url = new URL(window.location.href)
    url.searchParams.delete("variant")
    url.searchParams.set("idea", ideas[next].id)
    window.history.pushState(null, "", url)
    setActiveIndex(next)
  }, [activeIndex])

  useEffect(() => {
    const handlePopState = () => setActiveIndex(ideaIndexFromSearch(window.location.search))
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const target = event.target
      // Preserve arrow-key rotation when the globe canvas is focused.
      if (target instanceof Element && target.closest("input, textarea, select, canvas, [contenteditable], [role='slider']")) return
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      event.preventDefault()
      navigate(event.key === "ArrowLeft" ? -1 : 1)
    }
    window.addEventListener("popstate", handlePopState)
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("popstate", handlePopState)
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [navigate])

  useEffect(() => {
    document.title = `${idea.title} — Test / ${activeIndex + 1}`
  }, [idea, activeIndex])

  const arrowClass = `fixed top-1/2 z-30 grid size-11 -translate-y-1/2 place-items-center rounded-full border text-2xl shadow-sm backdrop-blur-md transition-[background-color,transform] hover:scale-105 active:scale-95 sm:size-12 ${idea.light ? "border-black/15 bg-white/75 text-neutral-800 hover:bg-white" : "border-white/20 bg-black/65 text-neutral-200 hover:bg-neutral-900"}`

  return (
    <div className={`min-h-svh ${idea.light ? "bg-white text-neutral-900" : "bg-black text-white"}`}>
      <main key={idea.id} aria-label={idea.label}>
        {idea.id === "pixel" ? <PixelFlowFieldDemo /> : idea.id === "kinetic" ? <KineticGridDemo /> : idea.id === "trail" ? <DottedTrailDemo /> : idea.id === "original" ? (
          <section className="flex min-h-svh items-center justify-center bg-black p-5">
            <OriginalRotatingEarth />
          </section>
        ) : (
          <section className="flex min-h-svh flex-col bg-background text-foreground">
            <header className="px-6 py-6 sm:px-10 sm:py-8">
              <span className="text-sm font-semibold tracking-[0.28em]">EARTH<span className="text-neutral-600">.</span></span>
            </header>
            <div className="flex flex-1 items-center justify-center px-4 pb-28"><DemoOne /></div>
          </section>
        )}
      </main>

      <nav aria-label="Переключение идей">
        <button type="button" onClick={() => navigate(-1)} aria-label={`Предыдущая идея: ${ideas[nextIdeaIndex(activeIndex, -1)].label}`} title="Предыдущая идея (←)" className={`${arrowClass} left-3 sm:left-6`}>←</button>
        <button type="button" onClick={() => navigate(1)} aria-label={`Следующая идея: ${ideas[nextIdeaIndex(activeIndex, 1)].label}`} title="Следующая идея (→)" className={`${arrowClass} right-3 sm:right-6`}>→</button>
      </nav>

      <div className={`pointer-events-none fixed inset-x-0 bottom-5 z-20 flex justify-center px-4 ${idea.light ? "text-neutral-800" : "text-neutral-300"}`}>
        <div className={`flex items-center gap-3 rounded-full border px-5 py-3 text-xs backdrop-blur-md ${idea.light ? "border-black/10 bg-white/80" : "border-white/10 bg-black/80"}`} role="status" aria-live="polite" aria-atomic="true">
          <span className="font-mono text-[10px] opacity-50">{String(activeIndex + 1).padStart(2, "0")} / {String(ideas.length).padStart(2, "0")}</span>
          <span className="h-3 w-px bg-current opacity-20" />
          <span>{idea.label}</span>
        </div>
      </div>
    </div>
  )
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>)
