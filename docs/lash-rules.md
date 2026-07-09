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

## 6. Retention factors (for future AI Photo Feedback / Phase 5)

Not yet defined. Owner to provide guidance on how retention % should be
estimated/tracked over time per client.

## 7. Owner review log

Use this section to log corrections after comparing AI-generated maps against
real lash-artist judgment (Phase 2 requirement).

| Date | Correction | Reason |
|---|---|---|
| _(none yet)_ | | |
