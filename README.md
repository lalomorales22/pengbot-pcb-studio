# 🐧 Penguin PCB Studio

> 3D PCB designer with freehand draw, chip placement, and JLCPCB Gerber export. Default board: **PengBot ESP32** (ESP32-WROOM-32E, USB-C) covered in Lalo's penguins; **PengBot Nano-328** (ATmega328P) one click away; and a **Cyberdeck Keyboard Builder** for custom-shaped hotswap keyboards with an optional touchpad.

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
    npm run smoke      # headless: writes the ESP32 + Nano-328 zips and two sample keyboards (gerbers + kit), asserts copper/silk/outline/drills + DRC
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

## Cyberdeck Keyboards ⌨🐧

Most cyberdecks use the same off-the-shelf mini keyboard. This builder makes a keyboard PCB **for your deck**: any outline,
any key layout, MX or Choc hotswap, optional touchpad or trackball, then real Gerbers, a switch plate, a case outline,
and flashable firmware. Open it with **⌨ Keyboard builder** in the header (or go to `http://localhost:5173/#keyboard`).

### Features
- **Presets:** *Deck 40* (compact staggered cyberdeck, 40 keys, 6.25u space, Cirque touchpad on), *40% ortho 4×12*,
  *60-key mini 5×12*, *Split-ish 36* (two 3×5 halves + thumbs on one PCB).
- **Key placement:** 1u = 19.05 mm. Drag keys with snap (1u, ¼u, ⅛u, 1 mm, off), arrows nudge, **R** rotates 90°,
  widths 1 / 1.25 / 1.5 / 1.75 / 2 / 2.25 / 2.75 / 6.25u, per-key legend, duplicate, delete.
- **KLE import:** paste the *Raw data* from [keyboard-layout-editor.com](http://www.keyboard-layout-editor.com) (or load the JSON).
  `x`/`y`/`w` offsets and legends are used. KLE rotation is ignored, with a warning. The kit also exports `layout/kle.json`.
- **Board shape:** rectangle, rounded, wedge (wider at the bottom), split (V notch between halves), or **custom**: drag
  vertices, click an edge to add one, double-click to delete, and set the corner radius (0–20 mm, filleted at export).
  **Import an outline** from SVG (path, polygon, rect, or circle; mm units from `width`/`viewBox`) or DXF (LWPOLYLINE/POLYLINE/LINE chain).
- **Mounting holes:** M2 (2.2 mm) or M2.5 (2.7 mm) NPTH. Click to place, then drag.
- **Switch footprints**, selectable per board (copied from [kiswitch](https://github.com/kiswitch/kiswitch), not invented):
  - MX hotswap = `SW_Hotswap_Kailh_MX_1.00u` (Kailh CPG151101S11 socket): 4.0 mm centre, 1.75 mm pegs at ±5.08, 3.05 mm pin holes,
    socket pads 2.55×2.5 at (−7.085, −2.54) / (5.842, −5.08) on B.Cu
  - Choc v1 hotswap = `SW_Hotswap_Kailh_Choc_V1_1.00u` (CPG135001S30): 3.45 mm centre, 1.9 mm pegs at ±5.5, pads at (−3.5, −6) / (8.5, −3.8)
  - MX keys ≥ 2u get Cherry PCB-mount stabilizer holes from `Stabilizer_Cherry_MX_2.00u / 6.25u / 7.00u`
    (±11.938 / ±50 / ±57.15; 3.048 mm and 3.9878 mm holes)
  - Per-key diode **1N4148W SOD-123** on the back (KiCad `Diode_SMD:D_SOD-123` pads ±1.65, 0.9×1.2), COL2ROW
- **Matrix + autorouter:** rows are clusters of key Y and columns are key order within each row, assigned automatically.
  A built-in 2-layer A* grid router (0.5 mm grid, 0.25 mm traces, 0.2 mm clearance) wires columns on top, rows on the
  bottom, and the controller and headers. Then an independent DRC checks clearance, shorts, edge, and connectivity. Building runs in a Web Worker (~1–3 s).
- **Controller (default): Adafruit KB2040** (RP2040, USB-C on the module) on a socketed **Pro Micro footprint**.
  It drops in without changes for SparkFun Pro Micro RP2040, or for **nice!nano v2** (nRF52840) when you want BLE with ZMK. The USB end sits flush with the board edge.
  Pin pool: 18 GPIO (TX, RX, 2–10, 14, 15, 16, 18–21). With I2C on, D2/D3 are reserved (KB2040 I2C1 SDA/SCL), which leaves 16 for the matrix.
- **QWIIC / I2C header (J1)** for the cyberdeck host: 1×4 0.1" in Qwiic order: GND, 3V3, SDA, SCL.
- **Touchpad / pointer (toggle):** reserves a round area (silk circle, plate cutout) plus a labelled 0.1" header (J2):
  - **Cirque TM040040 / TM035035** (Pinnacle 1CA027, I2C address 0x2A, QMK `cirque_pinnacle_i2c`): `3V3 GND SDA SCL DR`.
    DR gets a spare GPIO if one is free. The module's 12-pin 0.5 mm FFC pinout is **not verified here**, so wire it through an FFC breakout and check the Cirque datasheet.
  - **PMW3360 trackball** (SPI, QMK `pmw3360`): `3V3 GND SCK MOSI MISO CS MOT`. Breakout pin orders vary, so match labels.
- **Penguins:** Lalo's penguin is tiled over the back silk (hundreds of them), clipped to the outline and kept off pads and holes.
  Keycaps in 3D are penguin-coloured: white alphas, black mods, orange Esc/Space, ice-blue arrows/Enter.

### How to design one
1. **Start from** a preset (or *Blank*), or paste a KLE layout.
2. Drag and resize keys in the **2D layout** view. Use *Place key* to add keys.
3. Pick a **shape**, or switch to *Edit outline* and drag vertices to fit your deck's bay. You can also import its outline as SVG/DXF.
4. Choose **MX or Choc**, the **controller**, **QWIIC**, and the **touchpad**. Drag the controller, headers, touchpad, and holes where you want them.
   *Auto-arrange* re-places them and refits the outline.
5. **⚙ Build PCB** → 3D board view (orbit, top/bottom). The header shows **✓ DRC clean**, or lists what failed.
6. **⬇ Gerber zip** (fab files) and **⬇ Kit** (plate, case, firmware, KLE). Use *Save design* / *Open design* for `.penguin-kb.json`.
   *Open in PCB Studio* hands the routed board to the main studio for freehand art and extra parts.

### Ordering
- Upload `<name>-gerbers.zip` to JLCPCB as-is: 2 layers, 1.6 mm, any colour. It contains copper, mask, silk (top/bottom), bottom paste,
  outline (`.GKO`, the custom shape), plated drills (`.DRL`), and **non-plated drills (`-NPTH.DRL`: switch posts, stabilizers, mounting holes)**.
- Bill of parts per key: 1× Kailh hotswap socket (MX CPG151101S11 or Choc CPG135001S30), 1× 1N4148W SOD-123, switch, keycap.
  Plus one KB2040 (or nice!nano) on 2×12 sockets/headers, and optionally a Cirque module or PMW3360 board. `bom.csv`/`cpl.csv` mark the diodes
  as **Bottom**. LCSC part numbers are still blank, so this is a hand-solder build by default.
- **Plate:** `plate/plate.svg` or `plate.dxf`, MX 14.0 mm or Choc 13.8 mm cutouts, plus controller and touchpad cutouts and mounting holes.
  Laser-cut 1.5 mm steel/aluminium/FR-4 for MX (1.2 mm for Choc), or 3D-print it.
- **Case:** `case/case-outline.svg` has a 3 mm wall, a 0.5 mm PCB gap, M2/M2.5 bosses, and a dashed USB-C opening. Extrude it in your CAD tool.

### Firmware
The kit zip contains:
- `firmware/kmk/code.py` is **KMK on CircuitPython** for the KB2040 (the easy path). Install CircuitPython for KB2040, copy KMK's `kmk/`
  folder to `CIRCUITPY`, then drop in `code.py`. It sets the matrix pins as `board.D4…`, COL2ROW, `coord_mapping`, and a default keymap from your legends.
- `firmware/qmk/<kb>/keyboard.json` (+ `keymaps/default/keymap.json`, and a `rules.mk` for the pointing device) uses Pro Micro pin names, so
  `qmk compile -kb <kb> -km default -e CONVERT_TO=kb2040` (or `promicro_rp2040`) builds it.
- `firmware/zmk/` is a ZMK shield (`.overlay` with `&pro_micro` pins, `.keymap`, Kconfig, `build.yaml` for `nice_nano_v2`).
Firmware is a starting stub. Layers 1–2 are transparent, and pointing-device and I2C bus config beyond the driver line is left to you.

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
| `src/kb/keyboard.ts` | Keyboard model, presets, KLE import, outline shapes, layout → PCB generator |
| `src/kb/router.ts` | 2-layer A* grid autorouter |
| `src/kb/exports.ts` | KMK / QMK / ZMK firmware, plate SVG/DXF, case SVG, KLE export |
| `src/kb/KeyboardStudio.tsx`, `src/kb/importOutline.ts`, `src/kb/worker.ts` | Keyboard builder UI, SVG/DXF outline import, build worker |
| `scripts/smoke.ts` | Headless export + assertions |

## Penguin assets
`public/penguin.svg` (favicon/logo), `src/penguinArt.ts` (procedural badge), `public/samples/penguin-badge.png` (generated by smoke).

## Known gaps
- ESP32 board: no on-board USB-UART (USB-C is power only) — program through J2 TX0/RX0 with a 3.3 V adapter + BOOT/EN buttons.
  USB-C 6P, tact-switch and SOT-223 land patterns are close approximations; check them against the exact LCSC parts before ordering.
  The exposed GND pad has open vias-in-pad (fine for hand/hot-air soldering). No ESD diode on VBUS. The AMS1117 is ~1 A LDO (ok for Wi-Fi peaks, gets warm at 5 V in).
- Hand-drawn strokes and click-placed traces carry no net, so the DRC only checks clearance/shorts between netted items (the default design). It will not flag your own copper touching a pad.
- Image import is pixel-stairstep rectangles. The freehand studio has no autorouter, ratsnest, or bottom-layer drawing tool (the keyboard builder autoroutes both layers). Rotation is in 90° steps only.
- BOM has no LCSC part numbers; assembly not set up (the default board is a hand-solder THT/0805 build).

- Keyboards: key rotation is in 90° steps only (no arbitrary-angle thumb clusters yet; KLE `r` is ignored). No Choc stabilizers.
  The plate has no MX stabilizer cutouts (use PCB-mount stabs). The case is a 2D outline, not a 3D model. There is no RGB/encoders/OLED yet.
  Matrix size is limited to the Pro Micro's free GPIO (16 with I2C on, 18 off). The router can fail on very dense custom layouts, and the DRC then shows what is unrouted.
  Cirque FFC footprint is not included (0.1" header + breakout instead).

## License
MIT © 2026 Lalo Morales — see [LICENSE](LICENSE).
