---
name: ui-motion-3d
description: Build tasteful 3D/CSS motion for card carousels and immersive UI—billboard orbit, depth scaling, pause-on-hover—without nauseating flat 360 spins. Use for character archives, hero motion, and micro-interactions in Snow/forum.
---

# UI Motion 3D

## Prefer
- **Billboard orbit**: cards translate in XZ around Y; card faces stay screen-aligned (no spinning text upside-down).
- Depth cues via scale, opacity, z-index, slight brightness—not aggressive rotateY on content.
- Pause on hover/focus; prefers-reduced-motion: reduce → static layout.
- One primary motion per section; 2–3 intentional motions site-wide.

## Avoid
- Flat 2D rotate(360) rings that tip cards sideways.
- Infinite bounce/glow stacks; purple glow spam.
- Motion that fights reading (blurred text while rotating content).

## Implementation notes
- Use perspective on stage + 	ransform-style: preserve-3d on ring.
- Drive angles with rAF + dt clamping; pause when document.hidden.
