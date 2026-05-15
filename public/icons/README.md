# Icons

`icon-192.png` and `icon-512.png` are checked in as procedurally-generated
placeholders (brand color #0ea5e9 with a simple white checkmark). They satisfy
the PWA install requirement so manifest validation passes and the app gets a
non-broken icon on home screen / Add to Home Screen flows.

Replace before launch:
- 192x192 PNG → `icon-192.png`
- 512x512 PNG → `icon-512.png`
- Both should be opaque, "any maskable" safe (keep content within an 80% center square).

Generate production icons at https://realfavicongenerator.net or with any
designed asset run through `pwa-asset-generator`.
