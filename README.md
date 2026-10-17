# Earth — интерактивный глобус

Демо компонента `RotatingEarth` из 21st: чёрный фон, белые контуры материков, координатная сетка и точки на суше.

## Запуск

Нужен Node.js 22.12+ (или 24) и npm.

```bash
git clone https://github.com/Mortalzy/Test.git
cd Test
npm ci
npm run dev
```

Откройте адрес, который выведет Vite (обычно http://localhost:5173).

```bash
npm run build
npm run preview
```

Первая команда проверяет TypeScript и создаёт production-сборку в `dist/`, вторая запускает её локально.

## Структура

- `components/ui/wireframe-dotted-globe.tsx` — компонент глобуса.
- `components/demo.tsx` — пример подключения.
- `src/main.tsx` — страница демо.
- `src/index.css` — Tailwind CSS 4 и переменные темы.
- `lib/globe-geometry.ts` — генерация точек с учётом отверстий в полигонах.
- `lib/utils.ts` — стандартный shadcn-хелпер `cn`.
- `public/data/land.geojson` — локальные географические данные Natural Earth.

Проект настроен на React, TypeScript, Tailwind CSS 4. `components.json` содержит конфигурацию shadcn, алиас `@` указывает на корень проекта. Папка `components/ui` хранит переиспользуемые UI-компоненты; CLI shadcn использует её при добавлении компонентов, поэтому импорты остаются единообразными. Настраивать TypeScript или Tailwind заново не нужно.

При необходимости можно добавлять компоненты:

```bash
npx shadcn@latest add button
```

## Использование

```tsx
import RotatingEarth from "@/components/ui/wireframe-dotted-globe"

export default function Demo() {
  return <RotatingEarth width={800} height={600} className="mx-auto w-full" />
}
```

`width` и `height` ограничивают размер Canvas. Компонент подстраивается под контейнер и высоту окна. Провайдеры, ключи API, сервер и база данных не требуются.

## Управление

- Мышь или касание с перетаскиванием: вращение.
- Колёсико и кнопки `+` / `−`: масштаб от 0.5× до 3×.
- Пауза: остановка или продолжение автоматического вращения.
- Сбросить: восстановление начального положения и масштаба.
- Когда Canvas в фокусе: стрелки вращают, `+` / `−` меняют масштаб, `0` сбрасывает положение.

Автовращение учитывает `prefers-reduced-motion`. Обработчики, таймер, ResizeObserver и загрузка данных очищаются при размонтировании, включая React Strict Mode. Точки обратного полушария не рисуются. Щипок двумя пальцами не реализован; на телефоне масштаб меняется кнопками.

## Данные

Источник: [Natural Earth](https://www.naturalearthdata.com/), набор `ne_110m_land`, [GeoJSON](https://github.com/martynafford/natural-earth-geojson/blob/master/110m/physical/ne_110m_land.json). Данные Natural Earth находятся в общественном достоянии. Исходный компонент предоставлен пользователем; происхождение и условия его использования см. на странице компонента в 21st.
