# 🐧 Penguin PCB Studio

> 3D PCB designer with freehand draw, chip placement, and JLCPCB Gerber export. Default board: **PengBot ESP32** (ESP32-WROOM-32E, USB-C) covered in Lalo's penguins; **PengBot Nano-328** (ATmega328P) one click away.

3D (three.js / react-three-fiber) PCB studio: orbit a real 1.6 mm board, hand-draw on copper/silk, click-place traces,
vias, pads and chips, import art, run a quick DRC, and export a JLCPCB-ready Gerber zip.

## Features
- Three.js / react-three-fiber orbit view of a real 1.6 mm FR-4 board (Iso/Top/Bottom/Front views)
- Tools: brush (freehand), trace, via, pad, chip placement, select/move/rotate/delete, undo/redo
- Image import (PNG/JPG/SVG) thresholded onto silkscreen, copper, or mask
- DRC: clearance, shorts, edge clearance, net connectivity
- Export: Gerber RS-274X with X2 attributes, Excellon drill, BOM/CPL CSV (JLCPCB columns)
- Penguin theme throughout (UI, logo, procedural penguin badge silk)

## Quick start
Requires Node.js 20+.

    npm install
    npm run dev        # http://localhost:5173
    npm run build      # typecheck + production build
    npm run smoke      # headless: writes out/pengbot-esp32-gerbers.zip + out/pengbot-nano-328-gerbers.zip, asserts copper/pour/silk/outline/drills + DRC
    npx tsx scripts/render-preview.ts   # out/pengbot-esp32-{top,bottom}.png quick previews
    npx tsx scripts/penguin-mask.ts     # re-trace public/samples/lalo-penguin.png -> src/laloPenguinMask.ts

## Default project: PengBot ESP32 (orderable 2-layer board, covered in penguins)

- **Module:** **ESP32-WROOM-32E** (4 MB flash on-module, PCB antenna, common JLCPCB/LCSC stock part). Chosen over the
  C3-mini because it's the classic dual-core ESP32 with the most GPIO and the Arduino/ESP-IDF default, and its land pattern
  (38 pads @ 1.27 mm + exposed GND pad with 4 stitching vias) is hand-solderable.
- **Board:** **80 × 60 mm**, 2 layers, FR-4 1.6 mm. Top = signals (0.25 mm, 3V3 0.5 mm, GND 0.4 mm). Bottom = solid GND pour (0.3 mm clearance, thermal spokes).
- **Power:** USB-C 6-pin power-only receptacle (5.1 kΩ CC1/CC2 pull-downs → 5 V from any C charger) → AMS1117-3.3 (SOT-223) →
  3V3. 10 µF on VBUS + LDO in, 22 µF + 100 nF on LDO out, 22 µF + 100 nF where 3V3 enters J1.2. Blue power LED (1 kΩ).
- **EN / BOOT:** 10 kΩ pull-up + 1 µF on EN (power-on delay), SW1 = EN/RESET, SW2 = BOOT (pulls IO0 low). Flashing:
  any 3.3 V USB-UART on J2 **TX0/RX0/GND**, hold BOOT, tap EN, run `esptool`/Arduino upload.
- **Antenna:** module sits flush with the top board edge; the top 6 mm (antenna) is over a **40 × 6.4 mm copper keepout**
  (`y ≥ 53.6`, x 20–60) on both layers — no pour, traces, vias or penguins there (Espressif layout guideline). Don't put a ground plane or metal under it.
- **Flash pins** IO6–IO11 (SD0–SD3/CMD/CLK, module pins 17–22) are deliberately left unconnected.

| Header | Pins (top → bottom / left → right) |
|---|---|
| **J1** left, 1×14, 2.54 mm | GND · 3V3 · EN · VP36 · VN39 · IO34 · IO35 · IO32 · IO33 · IO25 · IO26 · IO27 · IO14 · IO12 |
| **J2** right, 1×13 | GND · IO23 · IO22 · TX0 · RX0 · IO21 · IO19 · IO18 · IO5 · IO17 · IO16 · IO4 · IO0 |
| **J4** bottom, 1×4 | IO13 · IO15 · IO2 · GND |

ADC1: VP36, VN39, IO34, IO35, IO32, IO33 (inputs only: 34/35/36/39). ADC2 (not usable while Wi-Fi is on): IO25–27, IO14, IO12, IO13, IO15, IO2, IO4, IO0.
Strapping pins: IO0 (BOOT), IO2, IO5, IO12 (keep low at boot or flash VDD_SDIO = 1.8 V), IO15.

### Penguins everywhere
Silk is tiled with **Lalo's own hand-drawn penguin** (`public/samples/lalo-penguin.png`). `scripts/penguin-mask.ts` keeps just the
dark ink lines (outline, eyes, beak, feet) and bakes them into `src/laloPenguinMask.ts`, so the board builds without decoding the PNG.
`tilePenguinArt({ cols, rows, scaleMm, marginMm, avoidRects, pitch, mirror, alternate, occupied })` (`src/penguinTile.ts`) stamps a
brick grid of copies, skipping anything that touches part courtyards, pads, vias, labels or the antenna keepout. The ESP32 preset does
6.4 mm penguins + a 3.6 mm gap-fill pass on **TopSilk (81 penguins)** and a dense mirrored grid on **BottomSilk (168 penguins)**.
Each penguin is 0.16 mm-pixel rectangles, so every stroke is ≥ 0.16 mm (JLC min 0.15); pads are also clipped with `%LPC%`.
**Colour choice:** white silk line-art on blue/navy solder mask — the bare blue mask fills in as the penguin's blue body, like the drawing.
Order with **blue** (or black) mask + white silk. In the app: *🐧🐧 Tile penguins* re-stamps after you move parts; *🐧 Lalo's penguin* imports it as normal art.


## Second project: PengBot Nano-328 (orderable 2-layer board)
- **MCU:** ATmega328P-PU (DIP-28, socketable, hand-solderable, Arduino-Uno-compatible, buy it with the Optiboot bootloader
  or flash via the ICSP pins on the headers). 16 MHz HC-49/S crystal + 2 × 22 pF, 100 nF on VCC and AVCC, 10 k reset pull-up,
  100 nF DTR auto-reset cap, 330 Ω + 0805 LED on D13.
- **Board:** 72 × 56 mm, 2 layers, FR-4 1.6 mm. Top: signals (0.3 mm, power 0.4 mm). Bottom: solid GND pour with 0.3 mm clearance and thermal spokes.
- **J1 (bottom header, 1×14, 2.54 mm):** RST D0 D1 D2 D3 D4 VCC GND X1 X2 D5 D6 D7 D8 (= MCU pins 1–14)
- **J2 (top header, 1×14):** A5 A4 A3 A2 A1 A0 GND AREF AVCC D13 D12 D11 D10 D9 (= MCU pins 28–15)
- **J3 (FTDI 1×6):** DTR TXO RXI VCC CTS GND (standard 5 V FTDI / CH340 adapter pinout; powers the board).
- **Rules (JLCPCB-safe):** min trace 0.15 (used 0.3/0.4), clearance ≥ 0.2, via 0.6/0.3 (0.15 annular ring), mask expansion 0.05,
  silk clipped 0.15 off pads, silk stroke ≥ 0.17 mm, copper ≥ 0.3 mm from edge, header drill 1.0, DIP/crystal drill 0.8.
- DRC pill in the header bar checks clearances, shorts and that every net is one connected island (top copper + bottom GND pour).

## Controls
| Tool (key) | What it does |
|---|---|
| Orbit (1) | left-drag rotate, right-drag pan, wheel zoom, click selects |
| Select / move (2) | click selects chip/trace/via/pad, drag chips to move, R rotates, Del deletes |
| Brush (3) | hand-draw smooth strokes on Copper or Silk (no snap, Chaikin-smoothed) |
| Trace (4) | click points (snapped), double-click / Enter finishes, Esc cancels |
| Via (5) / Pad (6) | click to drop a 0.6/0.3 via or 1.5 mm SMD pad |
| Place chip (7) | click to place selected footprint; R rotates ghost |
In every drawing tool right-drag orbits. Ctrl+Z undoes the last stroke/action, Ctrl+Shift+Z redoes. G toggles grid. View buttons: Iso/Top/Bottom/Front.

Library: 0805 R/C/LED, SOIC-8, QFN-16, DIP-8, DIP-28, HC-49 crystal, 1×6 and 1×14 headers, PengBot P1 module (invented penguin MCU module).

## Export
`penguin-pcb.GTL/GTS/GTO/GTP/GBL/GBS/GBO/GKO` + `penguin-pcb.DRL` (Excellon, plated) + `bom.csv` / `cpl.csv` (JLC columns,
LCSC # blank) + README. Upload the zip to JLCPCB as-is; check the online viewer before paying.

## How to order (JLCPCB)
1. `npm run smoke` (or Export in the app) → `out/pengbot-esp32-gerbers.zip` / `out/pengbot-nano-328-gerbers.zip` (zips are not committed; regenerate them).
2. Upload the zip at https://jlcpcb.com → defaults are fine (2 layers, 1.6 mm, HASL/ENIG).
3. Check the Gerber viewer, then order **bare boards**. The BOM has no LCSC numbers yet, so JLCPCB assembly isn't set up; hand-solder the THT/0805 parts.

## Project layout
| Path | What |
|---|---|
| `src/App.tsx` | UI shell, tools, layers, import/export |
| `src/Board3D.tsx` | Three.js scene, orbit, picking, drawing |
| `src/core.ts` | Data model + Gerber/drill/BOM/CPL writer |
| `src/esp32.ts` | PengBot ESP32 default design + penguin preset |
| `src/penguinTile.ts`, `src/laloPenguinMask.ts` | Penguin tiler + Lalo's traced penguin |
| `src/demo.ts` | PengBot Nano-328 design, stroke smoothing |
| `src/drc.ts` | Design rule + connectivity check |
| `src/footprints.ts` | Footprint library |
| `src/texture.ts` | Board texture rendering |
| `src/font.ts`, `src/penguinArt.ts` | Silk font, penguin art |
| `scripts/smoke.ts` | Headless export + assertions |

## Penguin assets
`public/penguin.svg` (favicon/logo), `src/penguinArt.ts` (procedural badge), `public/samples/penguin-badge.png` (generated by smoke).

## Known gaps
- ESP32 board: no on-board USB-UART (USB-C is power only) — program through J2 TX0/RX0 with a 3.3 V adapter + BOOT/EN buttons.
  USB-C 6P, tact-switch and SOT-223 land patterns are close approximations; check them against the exact LCSC parts before ordering.
  The exposed GND pad has open vias-in-pad (fine for hand/hot-air soldering). No ESD diode on VBUS. The AMS1117 is ~1 A LDO (ok for Wi-Fi peaks, gets warm at 5 V in).
- Hand-drawn strokes and click-placed traces carry no net, so the DRC only checks clearance/shorts between netted items (the default design). It will not flag your own copper touching a pad.
- Image import is pixel-stairstep rectangles. No autorouter, no ratsnest, no bottom-layer routing tool, rotation in 90° steps only.
- BOM has no LCSC part numbers; assembly not set up (the default board is a hand-solder THT/0805 build).

## License
MIT © 2026 Lalo Morales — see [LICENSE](LICENSE).
