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

> **STATUS: PARTIALLY CONFIRMED (updated 2026-07-15).** This is a new, additive axis
> (see `backend/src/services/lashMapRules.data.ts`) alongside the style/curl tables in
> §2–3 above, not a replacement of them — existing lash maps keep their original
> style/curl; new ones additionally carry a Lash Set + Lash Style. Diameters and the
> four Lash Style mapping-logic rows below were provided directly by the owner, Najat
> (vipluxebeauty@gmail.com) — a working lash artist — and independently reconfirmed via
> email on 2026-07-14, so should be treated as accurate. Zone-length (mm) and curl
> values in the
> tables are still PLACEHOLDER, same caveat as the rest of this file, and await
> separate owner review. See §10 for flagged judgment calls, including a proposed
> Pro-tier gate on Megavolume that needs owner confirmation.

**Lash Sets** (fan/application-density axis — mirrors §5's fan type guidance, but as an
artist-facing selectable name instead of an auto-derived value):

| Lash Set | Diameter | Inner | Inner-mid | Center | Outer-mid | Outer | Curl | Tier | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Classic | 0.15mm / 0.18mm / 0.20mm | 8 | 9 | 10 | 10 | 9 | C | Free | 1:1 extension-to-natural-lash ratio |
| Hybrid | Classic 0.15–0.20mm + volume fans 0.05mm / 0.07mm | 8 | 10 | 11 | 11 | 10 | CC | Free | mix of classic + volume fans (zone lengths PLACEHOLDER) |
| Volume | 0.05mm / 0.07mm / 0.10mm | 9 | 11 | 12 | 12 | 11 | CC | Free | 3D–4D fans (zone lengths PLACEHOLDER) |
| Megavolume | 0.02mm / 0.03mm | 10 | 12 | 14 | 14 | 12 | D | **Pro (flagged, see §10)** | ultra-fine diameter, 5D–8D+ fans, fullest look — highest-skill technique (zone lengths PLACEHOLDER) |
| Wet Set | not yet provided — falls back to §4 density-based diameter | 6 | 7 | 8 | 8 | 7 | C | Pro | shorter, styled wet/clumped look (zone lengths + diameter PLACEHOLDER) |
| Wet Wispy Set | 0.05mm / 0.07mm | 7 | 9 | 11 | 11 | 10 | CC | Pro | textured wet-look with mixed lengths; requires a Spike Map + Base Layer Map (§9a, zone lengths PLACEHOLDER) |
| Medusa Set | not yet provided — falls back to §4 density-based diameter | 6 | 11 | 8 | 13 | 9 | CC | Pro | spiky, mixed-length, not a smooth curve; requires a Spike Map + Base Layer Map (§9a, zone lengths + diameter PLACEHOLDER) |
| Anime Set | 0.05mm | 10 | 12 | 15 | 14 | 11 | D | Pro | dramatic, very long center; requires a Spike Map + Base Layer Map (§9a, zone lengths PLACEHOLDER) |
| Angel Set | not yet provided — falls back to §4 density-based diameter | 9 | 10 | 12 | 11 | 9 | CC | Free | soft, rounded, doll-like fullness (zone lengths + diameter PLACEHOLDER) |
| YY Set | not yet provided — falls back to §4 density-based diameter | 8 | 10 | 11 | 11 | 10 | CC | Free | Y-shaped fans for a fluffy, textured finish (zone lengths + diameter PLACEHOLDER) |

Diameters confirmed directly by the owner: Classic, Hybrid, Volume, Megavolume, Wet
Wispy Set, Anime Set. Diameters for Wet Set, Medusa Set, Angel Set, and YY Set have not
been provided yet — the rules engine falls back to the density-based estimate in §4 for
those until the owner supplies real values (see §10).

Tier column reflects which Lash Sets are gated to Pro subscribers in
`backend/src/services/planLimits.service.ts`'s `checkAdvancedLashSetAccess`. Wet Set,
Wet Wispy Set, Medusa Set, and Anime Set carry over the existing "Advanced styles (Pro
tier)" convention from §3. Megavolume's Pro gate is new and is a proposed judgment call
(ultra-fine 0.02mm–0.03mm diameters are a materially higher-skill, higher-risk
technique) — flagged in §10 for the owner to confirm or override, not asserted as
settled.

**Lash Styles** (eye-shape/finished-silhouette axis — a more granular alternative to
§2's style column; captured and displayed, but does not currently override the
zone-length/curl tables above pending owner guidance on how it should interact with
Lash Set):

| Lash Style | Mapping Logic | Best Suited For |
|---|---|---|
| Cat Eye | Shorter lengths at the inner corner; length gradually increases toward the outer corner; longest lengths concentrated at the outer section — creates a winged eyeliner effect. | Clients wanting a lifted, elongated appearance. |
| Doll Eye | Shorter lengths at the inner and outer corners; longest lengths placed in the center of the eye. | Clients wanting a bigger, more open-eye effect. |
| Open Eye | Short lengths at the inner corner; length increases toward the middle; longest point positioned around the center; length decreases again toward the outer corner. | Clients wanting the eyes to appear larger and more open. |
| Squirrel Eye | Length increases gradually from the inner corner; maximum length is placed slightly before the outer corner; outer-corner lengths are slightly shorter than the peak — a lifted, balanced effect without dragging the eye downward. | Clients who want a lifted but soft appearance. |
| Kitten Eye | A softer, shorter-winged cat eye. *(PLACEHOLDER — not yet confirmed by owner)* | — |
| Fox Eye | Dramatic outer lift, longer outer lengths. *(PLACEHOLDER — not yet confirmed by owner)* | — |
| Natural Eye | Mimics natural lash growth pattern, minimal drama. *(PLACEHOLDER — not yet confirmed by owner)* | — |

## 9a. Advanced Mapping: Spike Map + Base Layer Map (owner-provided 2026-07-15)

Anime Set, Wet Wispy Set, and Medusa Set are textured styles that require **two**
separate maps rather than the single 5-zone length table used for every other set:

1. **Spike Map** — determines spike location, spike length, spike distribution, and the
   overall texture pattern.
2. **Base Layer Map** — determines lower-layer lash lengths, fullness placement,
   supporting lashes between spikes, and the overall balance of the set.

The final design combines both maps into a structured, symmetrical, textured result.

> **Engineering note:** the current `LashMap.visual_map` JSONB shape (see
> `backend/src/services/lashmap.service.ts`'s `VisualMapZone`/`GeneratedLashMap` types)
> only models a single flat list of zones plus an optional `spike_lengths` array — it
> does not yet have a distinct "base layer" concept. Representing this properly needs a
> schema/type addition, not just a data-table update, so it has not been implemented in
> code yet. Flagged here so it isn't lost; pick up as a scoped follow-up rather than
> bolting it on ad hoc.

## 9b. Lash Mapping Variables & General Mapping Structure (owner-provided 2026-07-15)

For future customization support (not yet exposed in the mobile UI beyond Lash Set /
Lash Style), the mapping system should eventually support:

- Inner corner length
- Inner-middle transition length
- Maximum length placement
- Outer corner length
- Number of sections/zones
- Curl type selection
- Lash diameter selection
- Lash style selection

Each lash map conceptually breaks down into:

1. **Eye Style Selection** — Cat Eye, Doll Eye, Open Eye, Squirrel Eye, or Custom Map.
2. **Section Breakdown** — inner corner, inner eye, middle eye, outer eye.
3. **Length Assignment** — lash length per section (e.g. 8mm–15mm).
4. **Style Output** — a final lash map visualization showing where each length should
   be placed.

The goal is for an artist to select an eye style and get a recommended lash map
generated from it — which is already how `generateLashMap()` works for the 4 confirmed
Lash Styles above. A fully custom, per-variable map (arbitrary zone count, hand-tuned
lengths per zone, a "Custom Map" option) is not yet supported and would be a larger
feature addition beyond this data-table update.

## 10. Owner review log

Use this section to log corrections after comparing AI-generated maps against
real lash-artist judgment (Phase 2 requirement), and to flag proposed decisions that
need explicit owner confirmation before being treated as settled.

| Date | Correction / Flagged Item | Reason |
|---|---|---|
| 2026-07-15 | **Needs confirmation:** Megavolume was added to the Pro-tier gate (`ADVANCED_LASH_SETS` in `lashMapRules.data.ts`) alongside Wet Set / Wet Wispy Set / Medusa Set / Anime Set. | Proposed based on its 0.02mm–0.03mm diameter being a materially higher-skill, higher-risk technique than the other free-tier sets — not something the owner explicitly stated should be gated. Confirm or remove the gate. |
| 2026-07-15 | **Needs data:** Diameters for Wet Set, Medusa Set, Angel Set, and YY Set are still missing; the rules engine falls back to the §4 density-based estimate for these until provided. | Only Classic, Hybrid, Volume, Megavolume, Wet Wispy Set, and Anime Set diameters were provided in the 2026-07-15 update. |
| 2026-07-15 | **Needs data:** Zone-length (mm) and curl values for every Lash Set/Style in §9 are still PLACEHOLDER; only diameters and the 4 Lash Style mapping-logic descriptions (Cat Eye, Doll Eye, Open Eye, Squirrel Eye) were confirmed. | Same caveat as the rest of this file — these numbers were not part of the 2026-07-15 owner input and should not be treated as accurate yet. |
| _(none yet)_ | | |
