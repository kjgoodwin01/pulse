# Pulse — CLAUDE.md

Personal budgeting PWA for KG. Single-file app (`index.html`) — all React, styles, and logic live there. No build step, no bundler. Deployed via GitHub Pages at `/pulse/`.

---

## Architecture

- **Stack**: React 18 (UMD/CDN), Tailwind (CDN), Recharts, Babel standalone, JetBrains Mono + Poppins fonts
- **State**: `localStorage` key `pulse-data`. Load on mount, save on every `onUpdate()` call
- **API key**: stored separately in `pulse-api-key` localStorage key — never in state/git
- **Service worker**: `sw.js` handles PWA caching and update lifecycle
- **Data**: `data.json` in repo root — loaded on mount and merges over localStorage if present

## File Structure

```
index.html       — entire app (React components, styles, SW registration)
sw.js            — service worker
manifest.json    — PWA manifest
icon-192.png     — home screen icon (gradient indigo lightning bolt)
icon-512.png     — splash icon
favicon.png      — browser favicon
data.json        — optional live data override (cycleStart, cycleEnd, etc.)
```

---

## Color Palette

```js
const C = {
  bg:      "#0F172A",   // Slate Midnight — background
  blue:    "#6366F1",   // Indigo — primary actions, buttons, active nav
  emerald: "#38BDF8",   // Sky Blue — positive/good states (ring, on-pace)
  red:     "#FB7185",   // Soft Rose — danger, over-budget
  amber:   "#fbbf24",   // Amber — warnings
  purple:  "#a855f7",   // Purple — AI Advisor elements
  muted:   "#94A3B8",   // Indigo Mist — secondary text
  dim:     "#475569",   // Dim — labels, borders text
  faint:   "#1e293b",   // Faint — chart backgrounds
  text:    "#e2e8f0",   // Near-white — primary text
}
```

**Rule**: Never hardcode hex values outside `C`. Always reference `C.blue`, `C.red`, etc. so the palette stays consistent.

Category colors live in `C.cats` — don't swap these without checking the Activity/Spend charts.

---

## Nav Bar

### What works
The nav is a `flex-shrink-0` element at the bottom of the fixed shell. Height is controlled by:
1. `paddingBottom` on the outer nav div
2. `pt-X pb-X` on the inner flex row
3. Icon size passed to `React.cloneElement`

### The safe-area trick
```js
paddingBottom: "calc(env(safe-area-inset-bottom) - 35px)"
```
- `env(safe-area-inset-bottom)` is ~34px on Face ID iPhones
- Subtracting 35px brings it to ~-1px, effectively removing the safe-area inflation
- **Do NOT wrap in `max(Npx, ...)`** — the `max()` clamp is what killed all previous -35/-45/-55/-75px attempts (they all resolved to the same floor value)
- To reduce nav height further: lower `pt-X pb-X` on the inner row, or reduce icon size. Don't touch `paddingBottom` again unless adding safe-area back.

### Current nav config
```jsx
// Outer div
paddingBottom: "calc(env(safe-area-inset-bottom) - 35px)"

// Inner row
className="flex justify-around items-center max-w-lg mx-auto pt-1 pb-0"

// Icons
React.cloneElement(n.i, { width: 25, height: 25 })

// Labels: only active tab shows label
{tab===n.id && <span style={{fontSize:"8px",...}}>{n.l}</span>}
```

### Floating + button
Centered above nav with `left: 50%; transform: translateX(-50%)`. Previously was `right: 16px` which overlapped the Plan tab.

---

## PWA / Viewport Lock

### Pinch-zoom fix (Safari ignores `user-scalable=no`)
```css
html, body {
  height: 100%;
  overflow: hidden;
  position: fixed;   /* This is what actually kills zoom */
  width: 100%;
}
#root { height: 100%; overflow: hidden; }
* { touch-action: pan-y; }
input, textarea, select { touch-action: auto; } /* re-enable for inputs */
```

### App shell layout (native feel, header never scrolls)
```jsx
// Outer wrapper — fixed, full screen
<div style={{ position:"fixed", inset:0, display:"flex", flexDirection:"column" }}>
  <header className="flex-shrink-0">...</header>
  {/* Only this region scrolls */}
  <div style={{ flex:1, overflowY:"auto", WebkitOverflowScrolling:"touch", overscrollBehavior:"none" }}>
    {tab content}
  </div>
  <nav className="flex-shrink-0">...</nav>
</div>
```
**Never use `min-h-screen`** on the outer wrapper — it breaks the fixed shell and makes the whole page scroll including the header.

---

## PWA Update Banner

When a new SW is detected, show a banner — don't auto-reload. The flow:

```js
// sw.js registration (in index.html <script> tag)
newSW.addEventListener('statechange', () => {
  if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
    window.dispatchEvent(new CustomEvent('swUpdateReady', { detail: newSW }));
  }
});
// controllerchange → window.location.reload() handles the actual reload

// React App
const waitingSW = useRef(null);
useEffect(() => {
  const handler = (e) => { waitingSW.current = e.detail; setUpdateReady(true); };
  window.addEventListener('swUpdateReady', handler);
  return () => window.removeEventListener('swUpdateReady', handler);
}, []);

const handleUpdate = () => {
  if (waitingSW.current) waitingSW.current.postMessage('SKIP_WAITING');
};
```

---

## Generating PWA Icons

Icons are generated with Python/Pillow. Run this to regenerate after design changes:

```python
from PIL import Image, ImageDraw, ImageFilter

def make_icon(size):
    img = Image.new("RGBA", (size, size), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    r = size // 5
    draw.rounded_rectangle([0,0,size-1,size-1], radius=r, fill=(15,23,42,255))
    s = size / 36
    pad = size * 0.05
    pts_raw = [(21,2),(8,20),(17,20),(15,34),(28,16),(19,16)]
    pts = [(x*s+pad*0.5, y*s+pad*0.5) for x,y in pts_raw]
    # ... gradient bolt rendering (see full script in git history)
    return img.convert("RGB")

make_icon(192).save("icon-192.png")
make_icon(512).save("icon-512.png")
make_icon(192).save("favicon.png")
```

Lightning bolt path (viewBox 36×36): `21,2 8,20 17,20 15,34 28,16 19,16`
Gradient: `#e0e7ff → #818CF8 → #4338ca` (top to bottom)

---

## Tabs

| ID | Component | Notes |
|---|---|---|
| `home` | `Home` | Balance ring, DISCOVER + CHECKING inputs, recent txns |
| `spend` | `SpendTab` | Activity (search, categories, txn list) + Velocity charts combined |
| `loan` | `LoansTab` | Avalanche debt payoff simulator |
| `hp` | `HealthTab` | Income, fixed obligations, pie chart |
| `plan` | `PlanTab` | Upcoming expense simulator + AI Advisor chat |

Settings live in a bottom-sheet `Modal` triggered by the KG avatar, not a tab.

---

## AI Advisor (Plan Tab)

Uses the same Anthropic API key as the scanner. Builds a context string with the full financial snapshot on every message — checking balance, Discover balance, burn rate, income, obligations, all 5 loans, planned expenses, recent transactions. Model: `claude-sonnet-4-20250514`.

Header required for direct browser calls:
```js
"anthropic-dangerous-direct-browser-access": "true"
```

---

## Known Quirks

- **`S` component** wraps each child in a staggered `fadeUp` animation div. Keep this in mind when adding children — each direct child gets its own animated wrapper.
- **`G` component** is the card primitive. `p` prop sets padding class, `glow` adds a colored box-shadow.
- **Modals** are bottom-sheet style, `maxHeight: 78vh`. The inner scroll div needs `WebkitOverflowScrolling: touch` for iOS momentum scroll.
- **Cycle auto-advance**: `computeCycleDays()` rolls the cycle forward automatically when today passes `cycleEnd`. No manual reset needed.
- **manifest.json** still has old `background_color: #050A14` — update to `#0F172A` if regenerating.
