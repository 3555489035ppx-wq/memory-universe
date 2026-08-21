# Design QA

## Evidence

- Source player/layout truth: local QA captures, intentionally excluded from the public repository.
- Source template-directory truth: local QA captures, intentionally excluded from the public repository.
- Implementation evidence: browser verification and the curated screenshots linked from `README.md`.
- Desktop viewport: 1280 x 720 CSS px at device pixel ratio 1.2218749523162842.
- State: demo universe; template directory open for the directory check, then `那年夏天` active for the template-preview and player-stack check.

## Full-view comparison

The source player was visibly compressed and crowded beneath the active-template bar. The implementation restores the player to a centered 68rem desktop dock while keeping the active-template bar narrower, producing a deliberate hierarchy instead of two competing bars. The template directory is now a single balanced composition: two paired rows and one full-width final card, with no orphan card or empty right column.

## Focused comparison

Focused comparison was required because the defects were spatial: dock width, vertical overlap, card information density, and the fifth-card orphan state. At 1280 px, the player measures 1087.99 px wide, the template preview measures 831.99 px wide, and their vertical gap is 13.59 px. The page has 0 px horizontal overflow.

## Required fidelity surfaces

- Typography: template titles use the existing heavy product face at a restrained scale; descriptions and metadata have separate hierarchy rather than competing with the title.
- Information structure: every card now exposes template name, description, category, usable photo count, duration, Preview, and Use Template.
- Layout rhythm: paired cards share equal geometry; the fifth card spans the row and moves its actions into a dedicated right-side column.
- Materials: neutral transparent surfaces and thin silver borders remain consistent with the established interface, without adding a new opaque card style.
- Responsive behavior: the final card returns to a single-column card on narrower screens, and the player/template stack uses reduced safe-area offsets.

## Comparison history

1. P1: the player was constrained to about 38rem and visually collided with the active-template controls. Fix: restore a centered 68rem player and place the 52rem template bar 13.59 px above it.
2. P1: the template directory omitted photo count and duration, while actions competed with the copy. Fix: add a dedicated metadata row and full-width paired actions.
3. P1: the fifth template occupied only the left column and left a large blank area. Fix: span both columns and use a compact body/action split.
4. P2: the template panel could sit over the global music dock. Fix: hide the dock while the directory is open, then restore it when previewing or using a template.
5. P2: the directory required scrolling at the tested desktop viewport. Fix: reduce internal waste and fit all five templates within the available 720 px height.

## Interaction verification

- `预览` opens the selected template preview.
- `使用模板` closes the directory and activates the selected template.
- The music dock is hidden only while the template directory is open and returns in the preview state.
- All five cards fit without internal scrolling at 1280 x 720.
- Page horizontal overflow is 0 px.
- Full `pnpm run check` passed: lint, typecheck, 31 test files / 92 tests, and production build.

## Motion continuity pass

- Playback samples are now projected between sparse audio events, then corrected by the next authoritative sample. This prevents the template photos and camera from advancing in visible 250 ms steps.
- Photo transforms are evaluated directly in the render loop. The React layer no longer has to rebuild all photo states for every display frame.
- The template camera no longer uses a 20-step progress bucket. It follows the same continuous clock as the photos and updates from the live pose every frame.
- A shared per-frame audio snapshot removes repeated music-store reads across all visible photos; each photo still receives its own deterministic phase, so the group does not move as a rigid block.
- Drag smoothing was reduced to 45 ms and the canvas disables browser gesture interception, making orbit rotation start immediately while preserving a short inertial settle on release.
- Browser verification entered both `那年夏天` and `与你有关` template playback states with no runtime errors. Local QA captures are intentionally excluded from the public repository.

## Findings

No actionable P0, P1, or P2 differences remain for the reported player-stack and template-directory problems.

final result: passed

## Full-song cinematic choreography pass

- The high-school photo story now defaults to a 180-second desktop edit and, when a track is selected, automatically uses the complete remaining song duration instead of stopping after 30 seconds.
- A long track is split into 6.8-8.4 second authored scenes. The 210-second validation case produces at least 24 phases and uses 24 distinct layout/camera/motion recipes before any recipe can repeat.
- Each group scene now presents 24-30 photos. Photo windows rotate through the complete 80-photo library while current, previous, and next scenes remain bounded by the quality policy.
- Audio spectrum values no longer modify photo position, scale, rotation, or opacity. Music owns playback time only; all visual movement comes from the authored timeline.
- Hero-to-gallery transitions use an explicit crossfade. A 280 ms screenshot burst across the first boundary confirmed that the hero shrinks and fades while surrounding photos assemble, without a hard visibility cut.
- The hero scale was reduced from 3.15 to 2.55. Mosaic, tunnel, ribbon, cascade, orbit, galaxy, helix, and scattered layouts were widened and re-slotted for denser desktop compositions.
- Desktop evidence: curated screenshots linked from `README.md`; raw local QA captures are intentionally excluded from the public repository.
- Latest browser reload reported no application errors. The only warning is the existing Three.js `Clock` deprecation warning from a dependency.
- Final checks passed: ESLint, TypeScript, 32 test files / 97 tests, and production build.

final result: passed

## Photo motion variety and density pass

- Per the final direction, this pass does not use Apple Design or Awwwards motion principles. The motion language is authored specifically for Memuniverse and keeps only the requested photographic behaviors.
- The opening Hero is limited to one 2.4-second appearance, uses 16 supporting photos, and is smaller than the previous radio-scale treatment. Opening texture work is limited to micro/thumbnail assets.
- Full-song scenes now rotate through gravity drop, card shuffle, depth bloom, wave drift, contact-sheet-like grids, ribbon, tunnel, orbit, galaxy, helix, cascade, and scattered arrangements. Gravity drop is capped at two appearances per song.
- Dense story scenes request 38-44 photos; high/medium/low quality limits are 80/60/36. A shared plane geometry removes repeated geometry allocations while keeping one material per photo texture.
- Gravity scenes use deterministic top-entry trajectories, a bottom pile target, damped rebound, horizontal drift, and rotation. This remains seekable and pause-safe because it is driven by absolute timeline progress rather than a second stateful physics clock.
- The near-empty demo postcard remains available in the archive but is excluded from cinematic template selection, so it no longer reads as a failed rectangular texture. The template now reports 79 usable demo photos.
- Source ratios from 9:16 through 3:1 retain equal visual area and their original proportions; only pathological metadata beyond 1:4 or 4:1 is bounded for layout stability.
- Desktop evidence: curated screenshots linked from `README.md`. The sequence shows the opening at 1%, falling/landing frames at 4-7%, and no empty postcard slot; raw local QA captures are intentionally excluded from the public repository.
- Browser reload after the pass reported no application errors. The only message is the existing Three.js `Clock` deprecation warning from a dependency.
- Final `pnpm run check` passed: ESLint, TypeScript, 33 test files / 102 tests, and production build.

final result: passed
