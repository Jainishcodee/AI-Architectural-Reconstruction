# VRcam — Requirements

**Status:** working demo, verified end to end in a browser
**Last updated:** August 2026

---

## 1. The idea

Give a decorator a way to photograph a venue on their phone, rough the space out
in 3D, dress it with flowers, balloons, drapes and mandaps, and show the client
what the finished event will look like — with the bill of materials and the price
attached.

Originally framed as: *"I give photos of a building — front, back, interior — it
builds the 3D, and if the pieces are misplaced I nudge them into position like a
Rubik's cube or Clash of Clans."*

## 2. Does anything like this already exist?

The pieces exist. The combination does not.

| Product | What it does | Why it isn't this |
|---|---|---|
| [Prismm](https://www.prismm.com/) (ex-AllSeated, Cvent), ~$35/mo | 3D event diagramming, 150k venue floor plans, 10k objects, virtual tours | Venues come from **pre-built floor plans**, not your photos. Object library is tables and chairs, not floral or balloon installations. Enterprise-priced and enterprise-shaped. |
| [3D Event Designer](https://www.3deventdesigner.com/), Social Tables, Coohom, Homestyler | Floor-plan-first layout and render | Same gap — you must already have a plan; decor means furniture. |
| [Polycam](https://poly.cam/), Luma, RealityScan, Matterport | Real 3D venue capture (LiDAR, photogrammetry, gaussian splats) | Requires a full walkthrough scan, outputs a raw mesh, **zero decor tooling**. |
| [Meshy](https://www.meshy.ai/api), Tripo, Rodin, CSM | Image → 3D model over an API, ~$0.05–0.30/model | A component, not a product. No venue, no scene, no client-facing output. |

**Conclusion:** the gap is real. Nobody sells photos-in → dressed, priced,
client-shareable 3D-out, and nobody serves decor as a first-class object type.

## 3. Users

**Primary (the wedge): students and newcomers entering event decoration.**
No floor plans, no iPhone Pro, no CAD training, no portfolio. They need to look
credible in front of a first client and to produce a quote they can defend.

**Secondary (the buyer): working wedding planners, decorators, event vendors.**
Same tool, more volume, willing to pay.

**Market context:** Indian weddings and events. Decor is quoted, sold and
installed in **feet**; prices in **₹**. Venues are shared as WhatsApp photo dumps,
not CAD files.

## 4. The constraint that shapes the whole design

**You cannot reconstruct a building from four to six photos.**

Classical photogrammetry (COLMAP-style structure-from-motion) matches the same
physical feature across images and triangulates it. It needs
[60–80% overlap with every feature visible in 3+ images](https://support.pix4d.com/hc/best-practices-for-image-acquisition-and-photogrammetry).
With sparse photos it does not produce a poor model — it fails to solve at all.

Newer learned methods *can* produce rough geometry from very few images:

- **Sparse-view reconstruction** — [DUSt3R / MASt3R / VGGT](https://arxiv.org/abs/2507.14798)
  regress 3D pointmaps with no calibration or pose input; VGGT handles sets with
  minimal or no overlap, DUSt3R reached ~85% scene coverage from two images.
- **Monocular metric depth** — [Depth Pro, Metric3D v2, UniDepth](https://arxiv.org/html/2404.15506v4).
- **Room layout estimation** — [LayoutNet, HorizonNet, AtlantaNet](https://arxiv.org/pdf/1803.08999):
  single image in, wall/floor/ceiling planes out, robust to foreground clutter.

But all of them carry constraints that survive into the product:

1. **Scale is ambiguous.** Best-in-class metric depth runs 5–10% relative error —
   a foot or more on a 15 ft wall. Fine for a picture, useless for quoting 18 ft
   of garland. **One real measurement must govern.**
2. **Interior and exterior photos will never merge into one building.** A facade
   shot and an interior shot share no visible geometry; nothing registers them.
   The unit of work is therefore a **space**, not a building.
3. **They output point clouds, not flat walls.** A decor editor needs planes.
4. **They are GPU-bound** — a server or paid API, seconds of latency, real cost.

**Therefore the architecture is: AI proposes, the human corrects.** The estimator
never has to be right; it only has to save the user from a blank grid. The
drag-to-adjust step is not a workaround for weak AI — it is the safety net that
makes cheap, imperfect AI usable at all.

---

## 5. Functional requirements

### 5.1 Built and verified

| # | Requirement | Notes |
|---|---|---|
| F1 | A project holds multiple named **spaces**, each with its own geometry, photos, calibration and lighting | Tabs to switch, rename, duplicate, delete |
| F2 | Indoor (six-sided box) and outdoor (ground + backdrop) venue modes | Lawn and farmhouse events are half the market |
| F2b | **Extend a room into an L, T or U** by adding a wing off any wall, each with its own ceiling height. Shared walls open automatically; a lower neighbour leaves a transom above the opening | Venues are rarely one clean box. Wings are axis-aligned rectangles; openings come from 1-D interval subtraction per wall |
| F3 | Resize the room by dragging handles in the 3D view | Camera controls disabled during drag |
| F4 | Upload photos; pin one to any wall, floor or ceiling | Shared photo pool across spaces |
| F5 | **Correct a photo's perspective by dragging four corner handles**, re-rectifying live | GPU homography in the fragment shader |
| F6 | **Auto-align** proposes those four corners from detected edges | Hand-written Sobel + gradient-oriented Hough; declines rather than guessing |
| F7 | Scale calibration from one known real measurement, rescaling the space and its contents | Mandatory in spirit; BOM warns loudly until set |
| F8 | Parametric decor library — balloon garlands and columns, floral arches, marigold hangings, swags, mandaps, stages, backdrops, pillars, drapes, ceiling liners, fairy lights, uplighters, chair rows, guest tables | Editable span/colour/density |
| F9 | Upload a prop photo → background removed → placeable cutout | Free, offline, covers the long tail |
| F10 | Select, move, rotate, duplicate, delete decor; full undo/redo | Lighting and navigation excluded from undo |
| F11 | Four lighting presets (day, golden hour, evening, night) | Decorators sell ambience |
| F12 | First-person walkthrough at eye height | Catches decor that only works from a bird's-eye view |
| F13 | **Bill of materials** with quantities, editable rates, margin, and a total — per space or whole event | Quantities exact by construction |
| F14 | Client **presentation mode** — full screen, no editor UI, headline price, space switcher | The moment the job is won or lost |
| F15 | PNG export; copy BOM as a table | |
| F16 | Local-first autosave (IndexedDB); project export/import as JSON | Works offline |
| F17 | Four starter templates | A newcomer opening to an empty grid quits |
| F18 | Alignment corrections logged as `(photo, proposed, final, msSpentAdjusting, proposedBy)`, exportable as JSONL | The data moat; see §7 |

### 5.2 Next — blocked on credentials or input

| # | Requirement | Blocked on |
|---|---|---|
| F19 | **Share link** — read-only URL a client can orbit in their browser | Supabase (storage + a `/v/:id` route) |
| F20 | Tier 2 geometry — monocular depth or a layout net proposing the whole room | Replicate/Modal token; only worth it if Tier 1 struggles on real photos |
| F21 | Image → **true 3D mesh** for custom props (currently a flat cutout) | Meshy or Tripo API key, ~₹25/model |
| F22 | Real decor catalogue and rate card | Input from a working decorator |

### 5.3 Later

- Mobile AR viewer — hold the phone up in the real venue and see the decor.
- Fine-tuned estimator trained on the correction log (§7).
- Multi-user projects, client comments, quote versioning.
- PDF quote export with the render embedded.

---

## 6. Non-functional requirements

| Area | Requirement |
|---|---|
| **Offline** | The core editor must work with no network. A decorator's shop has bad wifi. Autosave is local; paid inference is strictly optional. |
| **Performance** | Must run on a mid-range laptop. Decor is instanced — a 240-balloon garland is one draw call, not 240. |
| **Units** | Authored and displayed in feet, stored in metres. Prices in ₹ with Indian digit grouping (₹1,04,653). |
| **No CAD skill** | Every interaction is drag, click or slider. No numeric entry required to get a result. |
| **Honest output** | The tool must never present a confident number it cannot support. Uncalibrated spaces are named in the BOM warning; cutouts contribute no price; the estimator declines rather than guessing. |
| **Privacy** | Venue photos belong to the user's clients. Default local-only; training consent explicitly opt-in at upload. |

---

## 7. The correction flywheel

Every hand-correction is training data, and it is the part of the product that
compounds. Prismm never sees a photo; Polycam never sees a decor scene.

**Loop 1 — geometry, supervised.** When the estimator proposes a quad and the
user drags it into place, the final state *is* the ground-truth label. This is
supervised fine-tuning, not RL — the user hands over the correct answer directly,
which is a strictly easier learning problem than preference optimisation.
Fine-tuned on Indian banquet halls, mandap stages and lawns, which no public
layout dataset covers, the estimator ends up better than anything off the shelf
*on the venues our users actually shoot*.

**Loop 2 — design taste, preference learning.** No ground truth exists for "good
decor". Signals are implicit: which suggestions are kept vs deleted, which scenes
get exported or shared, and — strongest of all — which quotes are marked *won*.
This is genuinely RL-shaped, and it is Phase 8+, not now.

**Now: log, do not train.** Correction events are captured from day one because
they cannot be collected retroactively. Two wins need no ML at all:
- Aggregate corrected layouts → smarter default room dimensions.
- `msSpentAdjusting` per tier is the honest measure of whether auto-align helps.
  If Tier 1 does not reduce adjustment time versus a blank box, it is not working
  regardless of how good the demo looks.

**Consent is not optional.** A free tier that trades training consent for access
is a fair and legible deal. Silent harvesting is not, and would be fatal to trust
with a professional user base.

---

## 8. Technical decisions worth keeping

| Decision | Reason |
|---|---|
| Photos are **textures on a hand-adjusted box**, not geometry | See §4. No method reconstructs a building from sparse photos. |
| A venue is a **list of axis-aligned rectangles**, not one box, and not a free polygon | Covers L, T and U shapes and per-area ceiling heights, while keeping the interaction "extend this wall" rather than "edit these vertices" — the target user has no CAD training. Rotation is deliberately excluded: it buys nothing and complicates the shared-wall subtraction. |
| Perspective warp runs in the **fragment shader** | Live re-rectification at frame rate with true perspective. A CPU canvas warp is affine per triangle and creases down the diagonal. |
| Decor is **parametric**, not downloaded models | Span/colour/density are the things decorators quote on; the BOM falls out for free; no hunt for CC0 mandap models that do not exist. |
| Line detection is **hand-written**, not OpenCV.js | 8 MB of wasm to run an edge filter is a bad trade for an offline-first tool. |
| Auto-align may use the **frame edge** as a bound | Real venue photos usually show only one room corner; the wall runs out of frame. Requiring two detected verticals made it decline on exactly the shots it should handle. |
| The store is **normalised** around spaces | The flat "working copy of the active space" alternative needs a commit before every save, export and switch — forgetting once loses the user's work. |
| Templates **add a space** rather than replacing the project | Wiping a decorator's work to show a starter scene is unforgivable. |

---

## 9. What is needed from the business side

**Free, and worth more than any credential:**

1. **10–20 real phone photos of actual halls, lawns and farmhouses.** The single
   biggest gap. Auto-align has only ever been tested against one synthetic image.
   Real photos have clutter, blur, wide-angle distortion and mixed lighting.
   Until these exist there is no way to know whether Tier 1 is sufficient or
   whether Tier 2 (§5.2) needs paying for.
2. **A real rate card** — per-unit prices in the target city for balloons,
   marigold per foot, drape panels, chairs and sashes, mandaps, labour. Every
   rate currently in the tool is invented.
3. **A ranked list of the 15 decor items that matter most**, from a working
   decorator.

**Credentials and spend, in priority order:**

4. Hosting — Vercel / Netlify / Cloudflare Pages (free tier sufficient); domain ~₹1,000/yr.
5. Supabase project URL + anon key — share links and storage.
6. Replicate or Modal token — Tier 2 geometry, ~₹2–8 per scene.
7. Meshy or Tripo key — image → 3D, ~₹25/model. Lowest priority; cutouts cover
   the long tail for free.

**Decisions only the owner can make:**

8. Accounts, or anonymous share links? Sharing works without login.
9. Consent wording and default for the correction log.
10. Confirm currency and locale (assumed ₹ / en-IN).
11. Does the free tier trade training consent for access?

---

## 10. Honest gap analysis against the original ask

| What was asked for | Status |
|---|---|
| Give photos of a venue — front, back, interior | **Done.** Multiple spaces, one per view. |
| "It creates the building in 3D" | **Not done, and deliberately not attempted.** See §4. What exists is a rough room whose surfaces show your photos, correctly perspective-corrected — convincing from the angles a client looks at, but a photo-lined box, not a reconstruction. |
| "If misplaced, adjust it like a Rubik's cube / Clash of Clans" | **Done, and it is the core of the product.** Drag walls to size, drag four corners to rectify each photo. |
| Decor components — flowers, balloons | **Done.** 16 parametric generators. |
| "If a component is not there, upload an image and it creates it as 3D" | **Half done.** Upload → background removed → placeable cutout, instantly and free. A true generated mesh needs an API key (F21). |
| "Show event organisers how the 3D decoration will look" | **Done.** Presentation mode, walkthrough, lighting presets, PNG export. Share links still need a backend (F19). |
| Bill of materials and pricing | **Done, and arguably the real business.** Not in the original ask, but it is what converts a picture into a job. |

---

## 11. Risks

- **Auto-align is unproven on real photographs.** Highest-priority unknown.
- **Rates are invented.** A confidently wrong quote is worse than no quote.
- **Parametric decor must look good, not merely be correct.** Look-dev, not logic.
- **Scale calibration is easy to skip and everything depends on it.**
- **The training flywheel needs volume the demo will not have.** Treat it as a
  moat that accrues, not a feature that ships.
- **Pointer lock, file pickers and drag interactions cannot be verified headless.**
  A walkthrough crash shipped past a passing headless test for exactly this
  reason. Browser tests for these paths must run headed.
