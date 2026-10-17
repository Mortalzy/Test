export const ideas = [
  { id: "custom", title: "Wireframe Earth", label: "Глобус · вариант 1", light: false },
  { id: "original", title: "Original Earth", label: "Глобус · оригинал 21st", light: false },
  { id: "trail", title: "Dotted Trail Cursor", label: "Точечный фон · след курсора", light: true },
] as const

export function ideaIndexFromSearch(search: string): number {
  const params = new URLSearchParams(search)
  const requested = params.get("idea") ?? params.get("variant") ?? "trail"
  const index = ideas.findIndex((idea) => idea.id === requested)
  return index < 0 ? ideas.length - 1 : index
}

export function nextIdeaIndex(index: number, direction: number): number {
  return ((index + direction) % ideas.length + ideas.length) % ideas.length
}
