# Lash Mapping Rules Engine — Source of Truth

> **STATUS: STUB / PLACEHOLDER.** This file has not yet been filled in by the owner
> (a lash artist / educator) with real industry rules. The values below are
> conservative, clearly-labeled placeholder defaults so the rules engine has
> something deterministic to run against. **Do not treat these as accurate lash
> industry standards.** The owner must review and replace before Phase 2 (internal
> testing) AI-accuracy review.

## How this file is used

`backend/src/services/lashmap.service.ts` reads the tables below to turn an
eye-analysis JSON (from the AI vision step) into a deterministic `LashMap`
(style, curl, per-zone length, diameter, fan type). The OpenAI vision call is
only used to classify eye shape / lash characteristics — the actual technical
recommendation values always come from this rules engine, never raw model
guesswork.

## 1. Eye shape classifications (input from vision analysis)

Expected `eye_shape` values the vision step should classify into:

- `round`
- `almond`
- `hooded`
- `monolid`
- `downturned`
- `upturned`
- `deep_set`
- `close_set`
- `wide_set`

## 2. Placeholder style/curl mapping by eye shape

| Eye shape | Recommended style | Recommended curl | Notes (PLACEHOLDER) |
|---|---|---|---|
| round | cat-eye | C | lengthen outer corners to elongate |
| almond | natural / wispy | C or CC | most curls work well |
| hooded | cat-eye | CC or D | more curl to show through crease |
| monolid | doll eye / cat-eye | CC | curl compensates for lid coverage |
| downturned | cat-eye | CC | lift outer corner |
| upturned | doll eye | C | balance the natural lift |
| deep_set | wispy | CC or D | more curl to bring lashes forward |
| close_set | cat-eye (outer emphasis) | C | extend length outward, keep inner corner shorter |
| wide_set | doll eye (inner emphasis) | C | extend length inward, keep outer corner shorter |

## 3. Placeholder zone length table (mm)

5-zone model: inner, inner-mid, center, outer-mid, outer.

| Style | Inner | Inner-mid | Center | Outer-mid | Outer |
|---|---|---|---|---|---|
| natural | 8 | 9 | 10 | 10 | 9 |
| wispy | 7 | 9 | 11 | 11 | 10 |
| cat-eye | 7 | 9 | 10 | 12 | 13 |
| doll eye | 9 | 10 | 11 | 10 | 8 |

**Advanced styles (Pro tier — requested explicitly, never auto-derived from eye shape):**

| Style | Inner | Inner-mid | Center | Outer-mid | Outer | Curl | Notes (PLACEHOLDER) |
|---|---|---|---|---|---|---|---|
| anime | 10 | 12 | 15 | 14 | 11 | D | dramatic, very long center for a wide-eyed look |
| medusa | 6 | 11 | 8 | 13 | 9 | CC | textured/spiky mixed lengths, not a smooth curve |
| wet-set | 6 | 7 | 8 | 8 | 7 | C | shorter overall — styled wet/clumped, not longer |
| kim-k | 8 | 11 | 12 | 15 | 16 | D | exaggerated dramatic winged cat-eye |
| strip-lash-effect | 11 | 12 | 13 | 13 | 12 | CC | fairly uniform length/density, mimics a strip lash band |

## 4. Placeholder diameter guidance

| Natural lash density | Recommended diameter |
|---|---|
| sparse / fine | 0.10mm–0.12mm |
| medium | 0.15mm |
| dense / coarse | 0.18mm–0.20mm |

## 5. Placeholder fan type guidance

| Client experience / retention goal | Fan type |
|---|---|
| first-time client, sensitive lashes | classic (1:1) |
| standard volume request | 3D–4D volume |
| mega volume request, healthy natural lashes | 5D–8D volume |

## 6. Retention factors (for future client timeline / Phase 5)

Not yet defined. Owner to provide guidance on how retention % should be
estimated/tracked over time per client.

## 7. Photo feedback scoring rubric (Phase 5)

> **STATUS: PLACEHOLDER.** Same caveat as the rest of this file — these criteria are
> a reasonable starting point for prompting the AI, not a validated professional
> rubric. The owner should review and correct based on real examples.

Used by `backend/src/services/ai.service.ts` (`scoreLashPhoto`) to build the system
prompt for scoring a photo of an artist's **completed** lash application — this is a
different input than the pre-work client eye photo used for lash mapping.

Each dimension is scored 0–100:

| Dimension | What "100" looks like (PLACEHOLDER) | What drags the score down |
|---|---|---|
| Isolation | Every extension applied to a single, cleanly separated natural lash; no visible stickies (two or more natural lashes bonded together) | Visible stickies, extensions bonded to skin/lid, uneven separation |
| Direction | Fans/extensions follow a consistent, deliberate direction matching the intended style (e.g. cat-eye sweeping outward); symmetric between both eyes | Crossing lashes, inconsistent angles, visible asymmetry between eyes |
| Styling | Overall shape matches a coherent, intentional style (natural, wispy, cat-eye, doll eye, etc.); density and length transition smoothly across zones | Patchy density, length jumps between zones, style doesn't match what the zone lengths would suggest |

An `overall_score` is the AI's holistic judgment, not strictly an average of the three
— it may weigh a severe isolation problem (a real lash-health risk) more heavily than a
minor styling inconsistency.

## 8. Glue & humidity recommendation table (Pro tier)

> **STATUS: PLACEHOLDER.** Same caveat as the rest of this file.

Used by `backend/src/services/glueRecommendation.service.ts` — deterministic, not
AI-based, same reasoning as the lash-mapping rules engine: retention depends heavily
on cure time, and giving a wrong recommendation has real consequences, so this isn't
left to free-form AI guessing.

| Humidity | Recommended glue viscosity | Approx. bonding/cure time | Notes (PLACEHOLDER) |
|---|---|---|---|
| Below 30% (low) | Thinner viscosity | Longer, ~5-6 seconds per lash | Consider a humidifier near the workstation; low humidity slows cure |
| 30–70% (ideal) | Standard viscosity | Standard, ~2-3 seconds per lash | This is the target range most glues are formulated for |
| Above 70% (high) | Thicker viscosity | Faster, ~1-2 seconds per lash | Consider a dehumidifier; high humidity over-accelerates cure and can cause bonding issues |

## 9. Lash Sets / Lash Styles (added 2026-07, replaces the "Style (Pro)"/"Technique" picker labels)

> **STATUS: PLACEHOLDER.** Same caveat as the rest of this file. This is a new,
> additive axis (see `backend/src/services/lashMapRules.data.ts`) alongside the
> style/curl tables in §2–3 above, not a replacement of them — existing lash maps
> keep their original style/curl; new ones additionally carry a Lash Set + Lash Style.

**Lash Sets** (fan/application-density axis — mirrors §5's fan type guidance, but as an
artist-facing selectable name instead of an auto-derived value):

| Lash Set | Inner | Inner-mid | Center | Outer-mid | Outer | Curl | Notes (PLACEHOLDER) |
|---|---|---|---|---|---|---|---|
| Classic | 8 | 9 | 10 | 10 | 9 | C | 1:1 extension-to-natural-lash ratio |
| Hybrid | 8 | 10 | 11 | 11 | 10 | CC | mix of classic + volume fans |
| Volume | 9 | 11 | 12 | 12 | 11 | CC | 3D-4D fans |
| Megavolume | 10 | 12 | 14 | 14 | 12 | D | 5D-8D+ fans, fullest look |
| Wet Set | 6 | 7 | 8 | 8 | 7 | C | shorter, styled wet/clumped look |
| Wet Wispy Set | 7 | 9 | 11 | 11 | 10 | CC | textured wet-look with mixed lengths |
| Medusa Set | 6 | 11 | 8 | 13 | 9 | CC | spiky, mixed-length, not a smooth curve |
| Anime Set | 10 | 12 | 15 | 14 | 11 | D | dramatic, very long center |
| Angel Set | 9 | 10 | 12 | 11 | 9 | CC | soft, rounded, doll-like fullness |
| YY Set | 8 | 10 | 11 | 11 | 10 | CC | Y-shaped fans for a fluffy, textured finish |

**Lash Styles** (eye-shape/finished-silhouette axis — a more granular alternative to
§2's style column; captured and displayed, but does not currently override the
zone-length/curl tables above pending owner guidance on how it should interact with
Lash Set):

| Lash Style | Description (PLACEHOLDER) |
|---|---|
| Cat Eye | winged, elongated outer corner |
| Kitten Eye | a softer, shorter-winged cat eye |
| Doll Eye | rounded, emphasis on center/middle length |
| Open Eye | brightens/opens the eye, balanced length throughout |
| Squirrel Eye | lifted outer corner with a fuller middle |
| Fox Eye | dramatic outer lift, longer outer lengths |
| Natural Eye | mimics natural lash growth pattern, minimal drama |

## 10. Owner review log

Use this section to log corrections after comparing AI-generated maps against
real lash-artist judgment (Phase 2 requirement).

| Date | Correction | Reason |
|---|---|---|
| _(none yet)_ | | |
