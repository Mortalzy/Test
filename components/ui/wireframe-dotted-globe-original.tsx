"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { pointInPolygon, type GlobePoint, type LandData } from "@/lib/globe-geometry"

interface RotatingEarthProps {
  width?: number
  height?: number
  className?: string
}

/** Original 21st appearance and interaction, using the same bundled land data. */
export default function OriginalRotatingEarth({ width = 800, height = 600, className = "" }: RotatingEarthProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return

    const containerWidth = Math.max(1, Math.min(width, window.innerWidth - 40))
    const containerHeight = Math.max(1, Math.min(height, window.innerHeight - 100))
    const radius = Math.min(containerWidth, containerHeight) / 2.5
    const dpr = window.devicePixelRatio || 1
    canvas.width = containerWidth * dpr
    canvas.height = containerHeight * dpr
    canvas.style.width = `${containerWidth}px`
    canvas.style.height = `${containerHeight}px`
    context.scale(dpr, dpr)

    const projection = d3.geoOrthographic()
      .scale(radius)
      .translate([containerWidth / 2, containerHeight / 2])
      .clipAngle(90)
    const path = d3.geoPath().projection(projection).context(context)
    const allDots: GlobePoint[] = []
    let landFeatures: LandData | null = null
    let disposed = false
    const controller = new AbortController()

    const generateDotsInPolygon = (feature: LandData["features"][number], dotSpacing = 16) => {
      const dots: GlobePoint[] = []
      const [[minLng, minLat], [maxLng, maxLat]] = d3.geoBounds(feature)
      const stepSize = dotSpacing * 0.08
      const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates
      for (let lng = minLng; lng <= maxLng; lng += stepSize) {
        for (let lat = minLat; lat <= maxLat; lat += stepSize) {
          const point: GlobePoint = [lng, lat]
          if (polygons.some((polygon) => pointInPolygon(point, polygon))) dots.push(point)
        }
      }
      return dots
    }

    const render = () => {
      context.clearRect(0, 0, containerWidth, containerHeight)
      const currentScale = projection.scale()
      const scaleFactor = currentScale / radius
      context.beginPath()
      context.arc(containerWidth / 2, containerHeight / 2, currentScale, 0, 2 * Math.PI)
      context.fillStyle = "#000000"
      context.fill()
      context.strokeStyle = "#ffffff"
      context.lineWidth = 2 * scaleFactor
      context.stroke()

      if (!landFeatures) return
      context.beginPath()
      path(d3.geoGraticule()())
      context.strokeStyle = "#ffffff"
      context.lineWidth = scaleFactor
      context.globalAlpha = 0.25
      context.stroke()
      context.globalAlpha = 1

      context.beginPath()
      landFeatures.features.forEach((feature) => path(feature))
      context.strokeStyle = "#ffffff"
      context.lineWidth = scaleFactor
      context.stroke()

      // Preserve the original dot projection, including its back hemisphere behavior.
      allDots.forEach((dot) => {
        const projected = projection(dot)
        if (projected && projected[0] >= 0 && projected[0] <= containerWidth && projected[1] >= 0 && projected[1] <= containerHeight) {
          context.beginPath()
          context.arc(projected[0], projected[1], 1.2 * scaleFactor, 0, 2 * Math.PI)
          context.fillStyle = "#999999"
          context.fill()
        }
      })
    }

    const loadWorldData = async () => {
      try {
        setError(null)
        const response = await fetch(`${import.meta.env.BASE_URL}data/land.geojson`, { signal: controller.signal })
        if (!response.ok) throw new Error("Failed to load land data")
        const data: LandData = await response.json()
        if (disposed) return
        landFeatures = data
        landFeatures.features.forEach((feature) => allDots.push(...generateDotsInPolygon(feature, 16)))
        render()
      } catch {
        if (!disposed) setError("Failed to load land map data")
      }
    }

    const rotation: [number, number] = [0, 0]
    let autoRotate = true
    let resumeTimeout: ReturnType<typeof setTimeout> | undefined
    let removeDragListeners: (() => void) | undefined
    const rotationTimer = d3.timer(() => {
      if (autoRotate) {
        rotation[0] += 0.5
        projection.rotate(rotation)
        render()
      }
    })

    const handleMouseDown = (event: MouseEvent) => {
      clearTimeout(resumeTimeout)
      removeDragListeners?.()
      autoRotate = false
      const startX = event.clientX
      const startY = event.clientY
      const startRotation = [...rotation]
      const handleMouseMove = (moveEvent: MouseEvent) => {
        rotation[0] = startRotation[0] + (moveEvent.clientX - startX) * 0.5
        rotation[1] = Math.max(-90, Math.min(90, startRotation[1] - (moveEvent.clientY - startY) * 0.5))
        projection.rotate(rotation)
        render()
      }
      const handleMouseUp = () => {
        removeDragListeners?.()
        resumeTimeout = setTimeout(() => { autoRotate = true }, 10)
      }
      removeDragListeners = () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
      }
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const scaleFactor = event.deltaY > 0 ? 0.9 : 1.1
      projection.scale(Math.max(radius * 0.5, Math.min(radius * 3, projection.scale() * scaleFactor)))
      render()
    }

    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("wheel", handleWheel, { passive: false })
    void loadWorldData()

    return () => {
      disposed = true
      controller.abort()
      rotationTimer.stop()
      clearTimeout(resumeTimeout)
      removeDragListeners?.()
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("wheel", handleWheel)
    }
  }, [width, height])

  if (error) {
    return (
      <div className={`dark flex items-center justify-center rounded-2xl bg-card p-8 ${className}`}>
        <div className="text-center">
          <p className="mb-2 font-semibold text-destructive">Error loading Earth visualization</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="dark h-auto w-full rounded-2xl bg-background"
        style={{ maxWidth: "100%", height: "auto" }}
        role="img"
        aria-label="Rotating Earth — drag to rotate and scroll to zoom"
      />
      <div className="dark absolute bottom-4 left-4 rounded-md bg-neutral-900 px-2 py-1 text-xs text-muted-foreground">
        Drag to rotate • Scroll to zoom
      </div>
    </div>
  )
}
