"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { generateLandDots, type GlobePoint, type LandData } from "@/lib/globe-geometry"

interface RotatingEarthProps {
  width?: number
  height?: number
  className?: string
}

interface GlobeControls {
  zoom: (factor: number) => void
  reset: () => void
}

export default function RotatingEarth({ width = 800, height = 600, className = "" }: RotatingEarthProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controlsRef = useRef<GlobeControls | null>(null)
  const pausedRef = useRef(false)
  const [paused, setPaused] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const context = canvas.getContext("2d")
    if (!context) {
      setIsLoading(false)
      setError("Браузер не поддерживает Canvas 2D.")
      return
    }

    const abortController = new AbortController()
    let disposed = false
    let containerWidth = 1
    let containerHeight = 1
    let radius = 1
    let zoomLevel = 1
    let land: LandData | null = null
    let dots: GlobePoint[] = []
    let rotation: [number, number, number] = [-15, -15, 0]
    let lastFrame = 0
    let resumeAt = 0
    let drag: { id: number; x: number; y: number; rotation: [number, number, number] } | null = null

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    pausedRef.current = reducedMotion.matches
    setPaused(reducedMotion.matches)
    const projection = d3.geoOrthographic().clipAngle(90).precision(0.3)
    const path = d3.geoPath(projection, context)
    const graticule = d3.geoGraticule10()

    const render = () => {
      context.clearRect(0, 0, containerWidth, containerHeight)
      const scale = projection.scale()
      context.beginPath()
      context.arc(containerWidth / 2, containerHeight / 2, scale, 0, Math.PI * 2)
      context.fillStyle = "#000"
      context.fill()

      context.beginPath()
      path(graticule)
      context.strokeStyle = "rgba(255,255,255,0.22)"
      context.lineWidth = 0.7
      context.stroke()

      if (land) {
        context.beginPath()
        path(land)
        context.strokeStyle = "rgba(255,255,255,0.85)"
        context.lineWidth = 0.85
        context.stroke()

        const center = projection.invert?.([containerWidth / 2, containerHeight / 2])
        if (center) {
          // Orthographic projection returns coordinates for the back hemisphere too.
          // Clip dots explicitly before drawing them on the canvas.
          context.beginPath()
          for (const dot of dots) {
            if (d3.geoDistance(dot, center) >= Math.PI / 2 - 0.008) continue
            const projected = projection(dot)
            if (!projected) continue
            const dotRadius = Math.max(0.65, Math.min(1.5, radius / 270)) * Math.sqrt(zoomLevel)
            context.moveTo(projected[0] + dotRadius, projected[1])
            context.arc(projected[0], projected[1], dotRadius, 0, Math.PI * 2)
          }
          context.fillStyle = "#999"
          context.fill()
        }
      }

      context.beginPath()
      context.arc(containerWidth / 2, containerHeight / 2, scale, 0, Math.PI * 2)
      context.strokeStyle = "#fff"
      context.lineWidth = 1.2
      context.stroke()
    }

    const resize = () => {
      containerWidth = Math.max(1, Math.min(width, container.clientWidth))
      containerHeight = Math.max(200, Math.min(height, containerWidth * 0.84, window.innerHeight - 240))
      radius = Math.min(containerWidth, containerHeight) * 0.45
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(containerWidth * dpr)
      canvas.height = Math.round(containerHeight * dpr)
      canvas.style.width = `${containerWidth}px`
      canvas.style.height = `${containerHeight}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      projection.scale(radius * zoomLevel).translate([containerWidth / 2, containerHeight / 2]).rotate(rotation)
      render()
    }

    const zoom = (factor: number) => {
      zoomLevel = Math.max(0.5, Math.min(3, zoomLevel * factor))
      projection.scale(radius * zoomLevel)
      render()
    }
    controlsRef.current = {
      zoom,
      reset: () => {
        rotation = [-15, -15, 0]
        zoomLevel = 1
        projection.rotate(rotation).scale(radius)
        render()
      },
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0) return
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, rotation: [...rotation] }
      canvas.setPointerCapture(event.pointerId)
      canvas.style.cursor = "grabbing"
    }
    const handlePointerMove = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return
      const sensitivity = 100 / radius
      rotation = [
        (drag.rotation[0] + (event.clientX - drag.x) * sensitivity) % 360,
        Math.max(-89, Math.min(89, drag.rotation[1] - (event.clientY - drag.y) * sensitivity)),
        0,
      ]
      projection.rotate(rotation)
      render()
    }
    const handlePointerEnd = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return
      drag = null
      resumeAt = performance.now() + 1000
      canvas.style.cursor = "grab"
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    }
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      zoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.002))
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "+", "=", "-", "0"].includes(event.key)) event.preventDefault()
      if (event.key === "+" || event.key === "=") return zoom(1.15)
      if (event.key === "-") return zoom(1 / 1.15)
      if (event.key === "0") return controlsRef.current?.reset()
      if (!event.key.startsWith("Arrow")) return
      if (event.key === "ArrowLeft") rotation[0] -= 5
      if (event.key === "ArrowRight") rotation[0] += 5
      if (event.key === "ArrowUp") rotation[1] = Math.min(89, rotation[1] + 5)
      if (event.key === "ArrowDown") rotation[1] = Math.max(-89, rotation[1] - 5)
      resumeAt = performance.now() + 2000
      projection.rotate(rotation)
      render()
    }
    const handleMotionChange = () => {
      pausedRef.current = reducedMotion.matches
      setPaused(reducedMotion.matches)
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    window.addEventListener("resize", resize)
    reducedMotion.addEventListener("change", handleMotionChange)
    canvas.addEventListener("pointerdown", handlePointerDown)
    canvas.addEventListener("pointermove", handlePointerMove)
    canvas.addEventListener("pointerup", handlePointerEnd)
    canvas.addEventListener("pointercancel", handlePointerEnd)
    canvas.addEventListener("lostpointercapture", handlePointerEnd)
    canvas.addEventListener("wheel", handleWheel, { passive: false })
    canvas.addEventListener("keydown", handleKeyDown)
    resize()

    const rotationTimer = d3.timer(() => {
      const now = performance.now()
      const delta = Math.min(now - lastFrame, 64)
      lastFrame = now
      if (pausedRef.current || drag || document.hidden || now < resumeAt || !land) return
      rotation[0] = (rotation[0] + delta * 0.012) % 360
      projection.rotate(rotation)
      render()
    })

    async function loadLand() {
      setIsLoading(true)
      setError(null)
      try {
        // Bundled locally, so the running demo does not depend on GitHub or CORS.
        const response = await fetch(`${import.meta.env.BASE_URL}data/land.geojson`, { signal: abortController.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data: LandData = await response.json()
        if (disposed) return
        land = data
        dots = generateLandDots(data)
        render()
        setIsLoading(false)
      } catch {
        if (disposed) return
        setError("Не удалось загрузить карту материков.")
        setIsLoading(false)
      }
    }
    void loadLand()

    return () => {
      disposed = true
      abortController.abort()
      rotationTimer.stop()
      resizeObserver.disconnect()
      controlsRef.current = null
      window.removeEventListener("resize", resize)
      reducedMotion.removeEventListener("change", handleMotionChange)
      canvas.removeEventListener("pointerdown", handlePointerDown)
      canvas.removeEventListener("pointermove", handlePointerMove)
      canvas.removeEventListener("pointerup", handlePointerEnd)
      canvas.removeEventListener("pointercancel", handlePointerEnd)
      canvas.removeEventListener("lostpointercapture", handlePointerEnd)
      canvas.removeEventListener("wheel", handleWheel)
      canvas.removeEventListener("keydown", handleKeyDown)
    }
  }, [width, height, attempt])

  const togglePause = () => {
    pausedRef.current = !pausedRef.current
    setPaused(pausedRef.current)
  }
  const buttonClass = "rounded-full border border-white/15 bg-black px-4 py-2 text-xs text-neutral-400 transition-colors hover:border-white/40 hover:text-white disabled:opacity-40"

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ maxWidth: width }}>
      <div className="relative flex justify-center overflow-hidden rounded-2xl">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="img"
          aria-label="Вращающийся глобус. Стрелки — вращение, плюс и минус — масштаб, ноль — сброс."
          aria-describedby="globe-instructions"
          aria-busy={isLoading}
          className="block max-w-full bg-black outline-offset-[-6px]"
          style={{ cursor: "grab", touchAction: "none" }}
        />
        {(isLoading || error) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center" role="status" aria-live="polite">
            <p className="text-sm text-neutral-400">{error || "Загрузка Земли…"}</p>
            {error && <button type="button" className={buttonClass} onClick={() => setAttempt((value) => value + 1)}>Попробовать ещё раз</button>}
          </div>
        )}
      </div>
      <div className="mt-4 flex flex-col items-center gap-5">
        <div className="flex flex-wrap items-center justify-center gap-2" aria-label="Управление глобусом">
          <button type="button" className={buttonClass} disabled={isLoading || !!error} onClick={togglePause} aria-pressed={paused}>{paused ? "Продолжить" : "Пауза"}</button>
          <button type="button" className={buttonClass} disabled={isLoading || !!error} onClick={() => controlsRef.current?.zoom(1 / 1.2)} aria-label="Отдалить">−</button>
          <button type="button" className={buttonClass} disabled={isLoading || !!error} onClick={() => controlsRef.current?.zoom(1.2)} aria-label="Приблизить">+</button>
          <button type="button" className={buttonClass} disabled={isLoading || !!error} onClick={() => controlsRef.current?.reset()}>Сбросить</button>
        </div>
        <p id="globe-instructions" className="text-center text-[11px] leading-5 text-neutral-600">Потяните, чтобы вращать <span className="px-2 text-neutral-800">/</span> Колёсико или кнопки + и − для масштаба</p>
      </div>
    </div>
  )
}
