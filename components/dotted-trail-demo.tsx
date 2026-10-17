import DottedTrailCursor from "@/components/ui/dotted-trail-cursor"

export default function DottedTrailDemo() {
  return (
    <DottedTrailCursor
      backgroundColor="#ffffff"
      dotColor="#d1d1d1"
      activeDotColor="#ffffff"
      colorA="#ff4fd8"
      colorB="#8b5cf6"
      className="!h-svh"
    >
      <p className="pointer-events-none absolute inset-x-14 bottom-24 text-center text-xs leading-5 text-neutral-500 sm:bottom-28">
        <span className="pointer-coarse:hidden">Двигайте курсором — за ним остаётся цветной след</span>
        <span className="hidden pointer-coarse:inline">Проведите пальцем по сетке</span>
      </p>
    </DottedTrailCursor>
  )
}
