import type { FeatureCollection, MultiPolygon, Polygon, Position } from "geojson"

export type LandData = FeatureCollection<Polygon | MultiPolygon>
export type GlobePoint = [number, number]

export function pointInRing([x, y]: GlobePoint, ring: Position[]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function pointInPolygon(point: GlobePoint, rings: Position[][]): boolean {
  return pointInRing(point, rings[0]) && !rings.slice(1).some((ring) => pointInRing(point, ring))
}

export function generateLandDots(data: LandData, spacing = 1.8): GlobePoint[] {
  const dots: GlobePoint[] = []
  for (const feature of data.features) {
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates
    for (const rings of polygons) {
      const outer = rings[0]
      const minLng = Math.min(...outer.map(([lng]) => lng))
      const maxLng = Math.max(...outer.map(([lng]) => lng))
      const minLat = Math.min(...outer.map(([, lat]) => lat))
      const maxLat = Math.max(...outer.map(([, lat]) => lat))
      for (let lat = Math.ceil(minLat / spacing) * spacing; lat <= maxLat; lat += spacing) {
        // Longitude lines converge at the poles: keep the apparent density even.
        const lngStep = spacing / Math.max(0.15, Math.cos(lat * Math.PI / 180))
        for (let lng = Math.ceil(minLng / lngStep) * lngStep; lng <= maxLng; lng += lngStep) {
          const point: GlobePoint = [lng, lat]
          if (pointInPolygon(point, rings)) dots.push(point)
        }
      }
    }
  }
  return dots
}
