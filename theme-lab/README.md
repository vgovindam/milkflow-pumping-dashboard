# MilkFlow High-End Theme Foundation

Status: **future / non-runtime**. This branch is intentionally isolated from production and must not be merged until the active Claude implementation is complete and reviewed.

## Purpose

Define a scalable visual-world architecture for MilkFlow without touching care data, routing, Firebase, PWA behavior, calculations, or the current production theme implementation.

The next iteration should extend the current strong contract already present in `experience-theme.js`:

- one visual manifest owns artwork
- Mom and Baby are coordinated but distinct
- light and dark are separately authored
- secondary pages inherit the same world
- functional cards remain readable
- theme code never owns care data or persistence

## Theme families

1. Animal Kingdom
2. Unicorn Dream
3. Butterfly Garden
4. Ocean / Under the Sea
5. Moon & Stars / Celestial
6. Woodland Forest
7. Safari Sunset
8. Floral Meadow
9. Cozy Clouds

A theme is an **atomic visual package**. It must not be exposed to users until Baby/Mom, light/dark, backgrounds, hero artwork, tile/motif artwork, chart palette, preview and fallbacks are complete and QA-approved.

## Future asset root

`assets/themes-next/<theme-id>/`

Each theme will eventually contain:

```
assets/themes-next/<theme-id>/
  manifest.json
  baby/
    light/
      background.webp
      hero.webp
    dark/
      background.webp
      hero.webp
  mom/
    light/
      background.webp
      hero.webp
    dark/
      background.webp
      hero.webp
  tiles/
    feeding.webp
    diapers.webp
    sleep.webp
    growth.webp
    pumping.webp
    nursing.webp
    stash.webp
    trends.webp
    wellness.webp
  motif.svg
  preview.webp
```

The actual runtime may choose SVG/WebP per slot. This folder contract exists to prevent ad-hoc filenames and scattered assets.

## Existing assets to reuse or evaluate

Do not reinvent these before reviewing them:

- `assets/themes/jungle-canopy.svg`
- `assets/themes/safari-adventure.svg`
- `assets/themes/safari-world.svg`
- `assets/themes/butterfly-garden.svg`
- `assets/themes/unicorn-dreams.svg`
- `assets/themes/cloud-island.svg`
- `assets/themes/forest-clearing.svg`
- `assets/theme-details/safari.svg`
- `assets/theme-details/butterfly.svg`
- `assets/theme-details/unicorn.svg`
- `assets/animals/*.svg`

These are source assets, not automatically approved final assets. Preserve any that meet the quality bar; replace only when a clearly superior high-end asset exists.

## Quality bar

Think premium parenting product, editorial children's illustration, and cinematic environmental art—not clipart, sticker packs, or generic gradients.

The visual hierarchy must always remain:

**data > interaction > readability > atmosphere**

Artwork may enrich the product but must never interfere with logging, trends, charts, navigation, forms or accessibility.
