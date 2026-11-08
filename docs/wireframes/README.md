# Wireframes and references

Reference images set mood, structure and density. They are not pixel specs: tokens and components come from `docs/tech/DESIGN_SYSTEM.md`, and the logo comes from `docs/brand/` (generated images draw it wrong).

| File | Screen | Spec |
| --- | --- | --- |
| `01-landing.png` | Landing, mobile and desktop | 02 |

Add images as `NN-screen.png` with the spec number they belong to, and add a row here.

## Generation prompt (shared style)

Used to generate references with an image model. Put the screen description after it.

```
Generate TWO separate images of the same web page:
1) MOBILE version, 390px wide, as ONE continuous tall screenshot.
2) DESKTOP version, 1440px wide, as ONE continuous screenshot.
Show only the web page itself, flat and edge-to-edge. NO device frames, NO notch, NO browser chrome, NO status bars. All text clean, readable English.

Visual style: light theme, warm cream background (#F2ECE4), off-white cards (#FBF8F4) with soft diffuse shadows and no hard borders, peach-orange accent (#F59A62), light peach tint (#FBD9C3), charcoal (#262626) for headings, main buttons and the bottom bar. Rounded corners 24–32px, pill buttons, Manrope, segmented arc gauges, soft orange line charts, soft 3D clay icons in peach tones. shadcn/ui + Tailwind with a custom warm theme. Generous spacing.

Brand: "Pampojo", wordmark in bold charcoal with an orange first "P" containing a dumbbell cut-out.
Product: offline-first gym workout tracker PWA.
Navigation in the app: mobile charcoal bottom bar (Calendar, Library, central orange Start button, Progress, Profile); desktop left sidebar with the same sections. Online/Offline pill in the top bar.
```
