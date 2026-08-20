# VRcam

Stage an event in 3D from a handful of venue photos, then hand the client a
picture and the quote that goes with it.

Built for students and newcomers to event decoration: no floor plans, no LiDAR
phone, no CAD training. Photos off a phone are enough.

```bash
npm install
npm run dev
```

## How it works

A project is a set of **spaces** — the mandap lawn, the entrance, the reception
hall. Tabs across the top switch between them; each has its own geometry, photos
and lighting, and they roll up into one quote. Photos of a building's front, back
and interior share no visible geometry and cannot be solved into a single model
by any method, so they are kept as what they actually are: separate scenes
belonging to the same event.

1. **Rough the room in.** Pick indoor (six-sided box) or outdoor (ground plus a
   backdrop). Drag the gold nubs in the 3D view to size it by eye.
2. **Pin your photos.** Assign each photo to a wall or the floor, then drag four
   handles onto that surface's corners as they appear in the photo. The wall
   re-rectifies live. **Auto-align** proposes the four handles for you.
3. **Set the real size.** Give one measurement you actually know. Everything
   scales with it, keeping the proportions you dialled in.
4. **Dress it.** Drag in balloon garlands, floral arches, marigold hangings,
   drapes, mandaps, stages, chairs, fairy lights. Anything missing: upload a
   photo of the prop and it drops in as a background-removed cutout.
5. **Sell it.** Hit **Present** for a full-screen client view — no panels, no
   gizmos, just the room, a light switch and the price, with one tap to walk the
   client through each space. Export a PNG, and copy the bill of materials —
   per space or for the whole event — straight into your quote.

## Design notes

**Photos never become geometry.** Classical photogrammetry needs 60–80% overlap
across many shots and cannot solve from five sparse photos. Learned methods
(DUSt3R/VGGT, monocular depth, room-layout nets) can, but they are GPU-bound,
scale-ambiguous, and produce point clouds rather than the flat planes a decor
editor needs. So the photos are *textures on a hand-adjusted box* — AI proposes,
the human corrects. The correction is the product, not a workaround.

**Interior and exterior photos are separate spaces.** A front-facade shot and an
interior shot share no visible geometry; nothing can register them into one
building. The unit of work is a space, and a project holds several.

**Scale calibration is mandatory in spirit.** Metric depth models run 5–10%
error — a foot on a 15 ft wall. You quote garland by the foot, so one real
measurement governs, and the BOM warns loudly until it is set.

**Decor is parametric, not downloaded models.** A balloon arch is instanced
spheres clustered along a curve; a marigold string is beads on a catenary. This
means colour/span/density are editable — the exact things decorators quote on —
the bill of materials falls out for free, and there is no hunt for CC0 mandap
models that do not exist.

**Everything is local-first.** IndexedDB autosave, no account, no network. It
has to work on a laptop in a shop with bad wifi.

## Layout

```
src/
  scene/      Stage, VenueShell, PhotoPlane (GPU homography), DecorItem, WalkControls
  decor/      registry + parametric generators (balloons, florals, structures, fabric, lights, furniture)
  geometry/   estimator (Tier 1 auto-align) + hand-rolled line detection
  editor/     Toolbar, VenuePanel, PhotoWarper, ScaleCalibrator, Library, Inspector, BOM
  store/      zustand scene store (+ zundo undo), IndexedDB persistence
  lib/        homography solver, background removal, surface frames
  templates/  four starter scenes
```

The perspective warp runs in the fragment shader (`PhotoPlane.tsx`): the wall's
UV is pushed through a homography uniform, so dragging a corner re-rectifies at
frame rate with true perspective. A CPU canvas warp would be affine per triangle
and crease down the diagonal.

Line detection (`geometry/lines.ts`) is a hand-written Sobel + gradient-oriented
Hough transform rather than OpenCV.js — 8 MB of wasm to run an edge filter is a
bad trade for a tool that must work offline.

## Not built yet

- **Share links.** Needs a backend (Supabase Storage + a `/v/:id` viewer route).
  Projects export/import as JSON in the meantime.
- **Tier 2 geometry.** Monocular depth or a layout net on a GPU endpoint, behind
  the same `geometry/estimator.ts` interface.
- **Image-to-3D** for custom props (Meshy/Tripo, ~₹25/model) — cutouts cover the
  long tail for free until it earns its cost.
- **Training on the correction log.** Every alignment fix is already logged as
  `(photo, proposed, final, msSpentAdjusting)` and exports as JSONL. Logging now
  is the point; it cannot be collected retroactively. Consent gating must land
  before any of it leaves the browser.
