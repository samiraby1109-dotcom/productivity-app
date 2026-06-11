# Icons

All icons here (plus `/favicon.ico`) are generated procedurally — no design
tooling or external services required:

```bash
node scripts/generate-icons.mjs
```

The motif (sun over meadow, brand sky palette) is deliberately neutral and
wellness-generic, consistent with the app's public positioning. Variants:

| File | Purpose |
|---|---|
| `icon-192.png`, `icon-512.png` | manifest `purpose: "any"` — rounded corners, transparent outside |
| `icon-maskable-192.png`, `icon-maskable-512.png` | manifest `purpose: "maskable"` — full-bleed, motif inside the 78% safe zone |
| `apple-touch-icon.png` | 180×180 full-bleed (iOS applies its own corner mask) |
| `/favicon.ico` | 32×32 BMP-in-ICO |

To swap in designed assets later, replace the files and keep the same names
and dimensions; keep maskable art within the centre ~80% safe zone and keep
the imagery neutral.
