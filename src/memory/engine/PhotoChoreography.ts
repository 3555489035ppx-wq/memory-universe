import type { TemplatePhotoState, TemplateTransform, TimelinePhase } from '../types';
import { seededSigned, seededUnit } from './seededRandom';
import { geometricSurfaceKind } from './composePhaseLayouts';

interface ChoreographyInput {
  memoryId: string;
  memoryIndex: number;
  phase: TimelinePhase;
  phaseProgress: number;
  seed: number;
  emphasis: TemplatePhotoState['emphasis'];
  incoming?: boolean;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Adds an authored journey inside each timeline phase. The layout remains the
 * semantic destination; this layer gives the photos a shared direction and an
 * individual trajectory before they settle into the next arrangement.
 */
export function choreographPhotoTransform(
  transform: TemplateTransform,
  input: ChoreographyInput,
): TemplateTransform {
  const progress = clamp01(input.phaseProgress);
  // Preserve the authored endpoints exactly. Apart from keeping the public
  // choreography contract deterministic, this prevents floating-point
  // remnants such as -0.00000001 degrees of rotation from becoming a tiny
  // target change on the hand-off frame.
  if (progress <= 0.000001 || progress >= 0.999999) return transform;

  const phaseKey = `${input.memoryId}:${input.phase.id}`;
  const phase = seededUnit(phaseKey, input.seed) * Math.PI * 2;
  const direction = seededSigned(phaseKey, input.seed + 17);
  const amplitude = 0.65 + seededUnit(phaseKey, input.seed + 31) * 0.55;
  const [baseX, baseY, baseZ] = transform.position;
  let x = baseX;
  let y = baseY;
  let z = baseZ;
  let scale = transform.scale;
  let opacity = transform.opacity;
  let rotationX = transform.rotation[0];
  let rotationY = transform.rotation[1];
  let rotationZ = transform.rotation[2];

  const motion = input.phase.motion ?? (
    input.phase.layout === 'tunnel' ? 'fly-through'
      : input.phase.layout === 'ribbon' ? 'ribbon-sweep'
        : input.phase.layout === 'cascade' ? 'cascade'
          : input.phase.layout === 'spotlight' ? 'hero-reveal'
            : input.phase.layout === 'orbit' || input.phase.layout === 'galaxy' ? 'carousel'
              : input.phase.layout === 'mosaic' ? 'gallery-lock'
                : input.phase.layout === 'scattered' ? 'disperse'
                  : 'assemble'
  );

  if (motion === 'gravity-drop' || motion === 'gravity-assemble') {
    const assembledDrop = motion === 'gravity-assemble';
    // Give the fall enough runway to read as weight instead of crossing a
    // large vertical distance in one display frame. The previous 0.34--0.42
    // window produced the exact up/down stutter seen in the recording.
    const fallEnd = (assembledDrop ? 0.56 : 0.5) + seededUnit(phaseKey, input.seed + 43) * 0.05;
    const fallProgress = clamp01(progress / fallEnd);
    const landingProgress = clamp01((progress - fallEnd) / Math.max(0.001, 1 - fallEnd));
    const incoming = input.incoming ?? false;
    const dropHeight = (assembledDrop ? 8.8 : 10.8) + amplitude * (assembledDrop ? 2.6 : 3.0);
    const dropOffset = incoming ? dropHeight * (1 - fallProgress) ** 1.55 : 0;
    const impactWindow = clamp01((progress - fallEnd) / 0.16);
    const impactPulse = Math.sin(impactWindow * Math.PI);
    // One damped impact reads as weight; several absolute-sine oscillations
    // read as a broken vertical jitter when the next chapter begins.
    const impactProgress = clamp01((progress - fallEnd) / 0.2);
    const bounce = progress > fallEnd
      ? Math.sin(impactProgress * Math.PI)
        * Math.exp(-4.8 * landingProgress)
        * (incoming ? (assembledDrop ? 1.18 : 1.02) : 0.16)
      : 0;
    const horizontalDrift = incoming
      ? direction * (0.85 + amplitude * 0.46) * (1 - fallProgress) ** 1.35
      : Math.sin(progress * Math.PI) * direction * 0.12;
    x += horizontalDrift;
    y += dropOffset + bounce;
    z += incoming
      ? Math.sin(progress * Math.PI * 1.4 + phase) * (1 - progress) * 0.65
      : Math.sin(progress * Math.PI) * direction * 0.08;
    scale *= incoming ? (0.76 + fallProgress * 0.24) * (1 - impactPulse * 0.075) : 1;

    return {
      position: [x, y, z],
      rotation: [
        transform.rotation[0]
          + direction * (incoming ? (assembledDrop ? 0.22 : 0.16) : 0.05) * (1 - fallProgress)
          + Math.sin(phase) * (1 - progress) * 0.08,
        transform.rotation[1] + direction * (incoming ? 0.06 : 0.02) * impactPulse,
        transform.rotation[2]
          + (incoming ? direction * (assembledDrop ? 0.62 : 0.5) * (1 - fallProgress) : 0)
          + direction * bounce * 0.11
          + direction * impactPulse * 0.05,
      ],
      scale,
      opacity,
    };
  }

  const envelope = Math.sin(progress * Math.PI);
  if (input.emphasis === 'hero') {
    z += 1.15 * envelope;
    y += direction * 0.06 * envelope;
    scale *= 1 + 0.16 * envelope;
  } else if (motion === 'fly-through') {
    x += Math.cos(phase) * 0.34 * envelope;
    y += Math.sin(phase) * 0.24 * envelope;
    z += (1.4 + amplitude * 1.55) * envelope;
    scale *= 1 + 0.08 * envelope;
  } else if (motion === 'ribbon-sweep') {
    x += direction * 0.72 * envelope;
    y += Math.sin(phase) * 0.56 * envelope;
    z += Math.cos(phase) * 0.38 * envelope;
  } else if (motion === 'cascade') {
    x += direction * amplitude * 0.72 * envelope;
    y += (0.45 + amplitude * 0.55) * envelope;
    z += direction * 0.42 * envelope;
  } else if (motion === 'carousel') {
    const rotation = direction * (0.2 + amplitude * 0.16);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const rotatedX = baseX * cos - baseY * sin;
    const rotatedY = baseX * sin + baseY * cos;
    x += (rotatedX - baseX) * envelope;
    y += (rotatedY - baseY) * envelope;
    z += direction * 0.6 * envelope;
  } else if (motion === 'gallery-lock') {
    z += (seededUnit(phaseKey, input.seed + 41) - 0.5) * 1.05 * envelope;
    scale *= 1 + 0.055 * envelope;
  } else if (motion === 'hero-reveal') {
    x *= 1 + 0.34 * envelope;
    y *= 1 + 0.24 * envelope;
    z -= 1.45 * envelope;
    scale *= 1 - 0.18 * envelope;
    opacity *= 1 - 0.42 * envelope;
  } else if (motion === 'disperse') {
    const radialLength = Math.max(0.5, Math.hypot(baseX, baseY));
    x += (baseX / radialLength) * amplitude * 0.9 * envelope;
    y += (baseY / radialLength) * amplitude * 0.58 * envelope;
    z -= amplitude * 0.72 * envelope;
    opacity *= 1 - 0.18 * envelope;
  } else if (motion === 'deck-shuffle') {
    const arrival = progress * progress * (3 - 2 * progress);
    const incoming = input.incoming ?? false;
    if (incoming) {
      x = baseX * (0.16 + arrival * 0.84) + direction * (1 - arrival) * 0.72;
      y = baseY * (0.2 + arrival * 0.8) + Math.sin(phase) * (1 - arrival) * 0.42;
      z = baseZ - (1 - arrival) * (2.4 + amplitude);
      scale *= 0.72 + arrival * 0.28;
    } else {
      x += direction * 0.32 * envelope;
      y += Math.sin(phase) * 0.2 * envelope;
      z += Math.cos(phase) * 0.22 * envelope;
    }
  } else if (motion === 'depth-bloom') {
    const incoming = input.incoming ?? false;
    const arrival = 1 - (1 - progress) ** 3;
    z -= incoming ? (1 - arrival) * (4.6 + amplitude * 1.8) : 0;
    x += Math.cos(phase) * amplitude * 0.34 * envelope;
    y += Math.sin(phase) * amplitude * 0.26 * envelope;
    scale *= incoming ? 0.58 + arrival * 0.42 : 1 + 0.04 * envelope;
    opacity *= incoming ? 0.64 + arrival * 0.36 : 1;
  } else if (motion === 'wave-drift') {
    const wave = Math.sin(progress * Math.PI * 2 + phase);
    x += direction * 0.46 * envelope;
    y += wave * amplitude * 0.42 * envelope;
    z += Math.cos(progress * Math.PI * 2 + phase) * 0.34 * envelope;
    scale *= 1 + wave * 0.025 * envelope;
  } else if (motion === 'wave-surface') {
    const lane = input.memoryIndex % 6;
    const travel = progress * Math.PI * 2.4 + phase + lane * 0.46;
    const crest = Math.sin(travel);
    const trough = Math.cos(travel * 0.72 + phase * 0.3);
    x += direction * (0.32 + lane * 0.035) * envelope;
    y += crest * (0.5 + amplitude * 0.2) * envelope + trough * 0.12 * envelope;
    z += (0.72 + amplitude * 0.26) * Math.cos(travel * 0.8) * envelope;
    rotationX += crest * 0.16 * envelope;
    rotationZ += direction * 0.12 * crest * envelope;
    scale *= 1 + crest * 0.032 * envelope;
  } else if (motion === 'film-rail') {
    const lane = input.memoryIndex % 4;
    const laneDirection = lane % 2 === 0 ? 1 : -1;
    const travel = progress * Math.PI * 2 + lane * 0.72 + phase * 0.18;
    // The photos are already tightly packed on the rail. A large lateral
    // sweep made adjacent frames collide at the motion peak, so carry the
    // energy through depth and alternating lanes instead of crossing cards.
    z += Math.cos(travel) * 0.32 * envelope;
    rotationZ += laneDirection * 0.075 * envelope;
  } else if (motion === 'accordion-fold') {
    const panel = input.memoryIndex % 8;
    const foldDirection = panel % 2 === 0 ? 1 : -1;
    const fold = Math.sin(progress * Math.PI * 2 + panel * 0.48) * envelope;
    x += foldDirection * 0.24 * envelope;
    y += Math.cos(panel * 0.7 + progress * Math.PI) * 0.16 * envelope;
    z += Math.abs(fold) * (0.58 + amplitude * 0.26);
    rotationY += foldDirection * (0.25 + amplitude * 0.08) * envelope;
    scale *= 1 + Math.abs(fold) * 0.035;
  } else if (motion === 'magnetic-swap') {
    const cluster = input.memoryIndex % 4;
    const clusterAngle = cluster * Math.PI / 2;
    const exchange = progress * Math.PI * 2 * direction;
    x += Math.cos(clusterAngle + exchange) * (0.42 + amplitude * 0.22) * envelope;
    y += Math.sin(clusterAngle + exchange) * (0.3 + amplitude * 0.16) * envelope;
    z += Math.cos(exchange + phase) * 0.44 * envelope;
    rotationZ += direction * 0.11 * envelope;
  } else if (motion === 'spiral-lift') {
    const lane = input.memoryIndex % 6;
    const rotation = direction * (0.16 + lane * 0.012) * envelope;
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const rotatedX = baseX * cos - baseY * sin;
    const rotatedY = baseX * sin + baseY * cos;
    x += rotatedX - baseX;
    y += rotatedY - baseY + (0.28 + lane * 0.045) * envelope;
    z += Math.sin(progress * Math.PI * 2 + lane * 0.6) * 0.38 * envelope;
    rotationY += direction * 0.09 * envelope;
  } else if (motion === 'helix-bloom') {
    const lane = input.memoryIndex % 7;
    const orbit = direction * (progress * Math.PI * 1.35 + phase * 0.12 + lane * 0.28);
    const radius = 0.64 + amplitude * 0.42 + lane * 0.035;
    x += Math.cos(orbit) * radius * envelope;
    y += (Math.sin(orbit) * (0.5 + amplitude * 0.22) + (progress - 0.5) * 0.34) * envelope;
    z += 0.95 * envelope + Math.sin(orbit * 0.7 + phase) * 0.42 * envelope;
    rotationZ += direction * 0.16 * envelope;
  } else if (motion === 'galaxy-constellation') {
    const angle = phase + input.memoryIndex * 2.39996;
    const burst = Math.sin(progress * Math.PI * 0.82);
    const radius = (0.34 + amplitude * 0.92) * burst;
    x += Math.cos(angle) * radius;
    y += Math.sin(angle) * radius * 0.62;
    z += (1.15 + amplitude * 0.52) * envelope;
    scale *= 1 + 0.085 * burst;
    rotationZ += direction * 0.18 * burst;
  } else if (motion === 'mosaic-lock') {
    const shutter = Math.sin(progress * Math.PI * 4 + phase) * envelope;
    const snap = 1 - Math.abs(Math.cos(progress * Math.PI * 2));
    x += direction * shutter * 0.22;
    y += Math.cos(phase + input.memoryIndex * 0.31) * 0.16 * envelope;
    z += snap * 0.58;
    scale *= 1 + snap * 0.07;
    rotationZ += direction * shutter * 0.06;
  } else if (motion === 'rain-drop') {
    const lane = input.memoryIndex % 8;
    // Only new cards fall in. Cards carried across a chapter boundary keep
    // their current position; applying the launch offset to already-visible
    // cards was the source of the two-frame vertical jump at the hand-off.
    const fall = input.incoming ? clamp01(1 - progress / 0.72) : 0;
    const laneOffset = (lane - 3.5) * 0.22;
    // Keep the launch inside the camera-safe frame. The previous 4.4-unit
    // lift put nearly every incoming card above the viewport at the chapter
    // boundary, creating an empty star field instead of a forceful fall.
    x += laneOffset * fall + direction * 0.46 * fall ** 1.35;
    y += (1.9 + amplitude * 0.8) * fall ** 1.55;
    z -= (0.72 + amplitude * 0.42) * fall;
    rotationZ += direction * (0.38 + lane * 0.028) * fall;
    scale *= 0.82 + (1 - fall) * 0.18;
  } else if (motion === 'topdown-ripple') {
    const radius = Math.max(0.35, Math.hypot(baseX, baseY));
    const angle = Math.atan2(baseY, baseX) + direction * 0.18;
    const ripple = Math.sin(progress * Math.PI * 2.2 - radius * 1.8 + phase) * envelope;
    x += Math.cos(angle) * ripple * (0.44 + amplitude * 0.18);
    y += Math.sin(angle) * ripple * (0.32 + amplitude * 0.12);
    z += ripple * 0.72;
    scale *= 1 + ripple * 0.035;
    rotationZ += direction * ripple * 0.12;
  } else if (motion === 'galaxy-orbit') {
    const orbit = direction * progress * Math.PI * 2.1 + phase;
    const radius = 0.38 + amplitude * 0.28 + Math.hypot(baseX, baseY) * 0.06;
    x += Math.cos(orbit) * radius * envelope;
    y += Math.sin(orbit) * radius * 0.72 * envelope;
    z += Math.sin(orbit * 0.6 + phase) * 0.9 * envelope;
    rotationZ += direction * 0.2 * envelope;
  } else if (motion === 'reassemble') {
    const radialLength = Math.max(0.5, Math.hypot(baseX, baseY));
    const convergence = 1 - (1 - progress) ** 1.8;
    // A card carried from the previous chapter already has a meaningful
    // position. Only cards newly introduced to this chapter should launch
    // outward and converge; otherwise the first sample of the effect moves
    // an existing card by a full radius and looks like a shake.
    const launch = input.incoming ? 1 - convergence : 0;
    x += -(baseX / radialLength) * (0.94 + amplitude * 0.36) * launch;
    y += -(baseY / radialLength) * (0.58 + amplitude * 0.24) * launch;
    z += Math.sin(progress * Math.PI * 1.6 + phase) * 0.62 * envelope;
    scale *= 0.84 + convergence * 0.16;
    rotationZ += direction * 0.3 * launch;
  } else if (motion === 'photo-flip') {
    const flip = Math.sin(progress * Math.PI * 2 + phase) * envelope;
    x += direction * 0.54 * envelope;
    y += Math.cos(phase + input.memoryIndex * 0.2) * 0.22 * envelope;
    z += Math.abs(flip) * 0.92;
    rotationY += direction * 0.44 * flip;
    rotationZ += direction * 0.1 * envelope;
    scale *= 1 - Math.abs(flip) * 0.035;
  } else if (motion === 'afterglow-wave') {
    const primary = Math.sin(progress * Math.PI * 3 + phase);
    const secondary = Math.cos(progress * Math.PI * 1.4 + phase * 0.7);
    x += direction * (0.42 + amplitude * 0.2) * envelope;
    y += primary * (0.34 + amplitude * 0.22) * envelope;
    z += secondary * 0.7 * envelope;
    scale *= 1 + secondary * 0.035 * envelope;
    opacity *= 1 - 0.035 * Math.max(0, progress - 0.55) * 2.2;
  } else if (motion === 'vortex-drift') {
    const turn = direction * (progress * Math.PI * 2.4 + phase);
    const radius = 0.36 + amplitude * 0.78;
    x += Math.cos(turn) * radius * envelope;
    y += Math.sin(turn) * radius * 0.56 * envelope;
    z += Math.sin(turn * 0.52 + phase) * 0.92 * envelope;
    rotationY += direction * 0.32 * envelope;
  } else if (motion === 'prism-turn') {
    const spin = direction * (progress * Math.PI * 2 + phase);
    x += Math.sin(spin) * (0.42 + amplitude * 0.18) * envelope;
    y += Math.sin(spin * 2 + phase) * 0.24 * envelope;
    z += (Math.abs(Math.cos(spin)) - 0.5) * 1.1 * envelope;
    rotationY += direction * (0.46 + amplitude * 0.16) * envelope;
    scale *= 1 + Math.abs(Math.sin(spin)) * 0.075 * envelope;
  } else if (motion === 'starburst-lane') {
    const lane = input.memoryIndex % 6;
    const angle = phase + lane * Math.PI / 3;
    const burst = Math.sin(progress * Math.PI * 0.92);
    const radius = (0.3 + amplitude * 1.1) * burst;
    x += Math.cos(angle) * radius;
    y += Math.sin(angle) * radius * 0.68;
    z += (0.32 + lane * 0.08) * burst;
    rotationZ += direction * 0.16 * burst;
  } else if (motion === 'orbital-cross') {
    const cross = Math.sin(progress * Math.PI * 2 + phase);
    const counter = Math.cos(progress * Math.PI * 3 + phase * 0.6);
    x += cross * (0.54 + amplitude * 0.2) * envelope;
    y += counter * 0.42 * envelope;
    z += Math.cos(progress * Math.PI * 2 + phase) * 0.72 * envelope;
    rotationZ += direction * 0.12 * cross * envelope;
  } else if (motion === 'depth-surge') {
    const surge = Math.sin(progress * Math.PI);
    const incomingDepth = input.incoming ? (1 - progress) * (2.4 + amplitude * 0.9) : 0;
    x += direction * (0.38 + amplitude * 0.16) * surge;
    y += Math.cos(progress * Math.PI * 2 + phase) * 0.3 * surge;
    z += incomingDepth + (1.2 + amplitude * 0.75) * surge;
    scale *= input.incoming ? 0.76 + progress * 0.24 : 1 + 0.06 * surge;
  } else if (motion === 'gravity-sling') {
    const flight = input.incoming ? 1 - progress : progress;
    const arc = Math.sin(flight * Math.PI);
    // The sling is a loop inside the chapter, not a new resting position.
    // Closing it with the shared envelope keeps the last frame identical to
    // the authored layout and prevents the next chapter from snapping back.
    x += direction * (0.88 + amplitude * 0.28) * flight * envelope;
    y += (input.incoming ? 1 : -1) * (0.48 + amplitude * 0.28) * arc * envelope;
    z += Math.cos(flight * Math.PI * 1.4 + phase) * 0.62 * envelope;
    rotationZ += direction * 0.3 * flight * envelope;
  } else if (motion === 'ring-collapse') {
    const radialLength = Math.max(0.5, Math.hypot(baseX, baseY));
    const collapse = Math.sin(progress * Math.PI);
    const angle = Math.atan2(baseY, baseX) + direction * collapse * 0.7;
    x -= Math.cos(angle) * (0.62 + amplitude * 0.2) * collapse;
    y -= Math.sin(angle) * (0.44 + amplitude * 0.16) * collapse;
    z += (radialLength / 4) * collapse + Math.cos(angle + phase) * 0.38 * collapse;
    rotationY += direction * 0.2 * collapse;
  } else if (motion === 'ribbon-corkscrew') {
    const travel = direction * (progress * Math.PI * 2.2 + phase);
    x += direction * (0.52 + amplitude * 0.2) * envelope;
    y += Math.sin(travel) * 0.64 * envelope;
    z += Math.cos(travel) * 0.78 * envelope;
    rotationY += direction * 0.28 * envelope;
    rotationZ += Math.sin(travel) * 0.12 * envelope;
  } else if (motion === 'wave-fold') {
    const fold = Math.sin(progress * Math.PI * 2 + input.memoryIndex * 0.38 + phase);
    x += direction * fold * 0.56 * envelope;
    y += Math.cos(progress * Math.PI * 3 + phase) * 0.34 * envelope;
    z += Math.abs(fold) * 0.86 * envelope;
    rotationY += direction * 0.34 * fold * envelope;
    scale *= 1 + Math.abs(fold) * 0.04 * envelope;
  } else if (motion === 'tunnel-shatter') {
    const shard = (input.memoryIndex % 5) - 2;
    const escape = input.incoming ? 1 - progress : envelope;
    x += direction * shard * 0.18 * escape;
    y += Math.sin(phase + shard) * 0.46 * escape;
    z += input.incoming ? -(2.2 + amplitude) * escape : Math.cos(phase + progress * Math.PI) * 0.7 * envelope;
    rotationX += direction * 0.16 * escape;
    rotationZ += shard * 0.08 * escape;
  } else if (motion === 'constellation-breathe') {
    const breath = Math.sin(progress * Math.PI * 2 + phase) * 0.16 * envelope;
    x += baseX * breath;
    y += baseY * breath * 0.72;
    z += Math.cos(progress * Math.PI * 2 + phase) * 0.56 * envelope;
    scale *= 1 + breath * 0.34;
    rotationZ += direction * breath * 0.6;
  } else if (motion === 'magnetic-arc') {
    const arc = progress * Math.PI * direction;
    const radius = 0.52 + amplitude * 0.22;
    x += Math.cos(arc + phase) * radius * envelope;
    y += Math.sin(arc + phase) * radius * 0.62 * envelope;
    z += Math.sin(arc * 1.4 + phase) * 0.74 * envelope;
    rotationY += direction * 0.24 * envelope;
  } else if (motion === 'particle-lift') {
    const lift = input.incoming ? 1 - progress : envelope;
    const jitter = Math.sin(progress * Math.PI * 5 + phase) * 0.18 * lift;
    x += direction * jitter;
    y += (0.64 + amplitude * 0.3) * lift;
    z += Math.cos(progress * Math.PI * 2 + phase) * 0.52 * lift;
    rotationZ += direction * 0.26 * lift;
    scale *= 0.84 + 0.16 * (1 - lift);
  } else if (motion === 'spiral-shear') {
    const shear = Math.sin(progress * Math.PI * 2 + phase) * envelope;
    x += baseY * 0.12 * shear + direction * 0.42 * envelope;
    y += (baseX * 0.08 * shear + (progress - 0.5) * 0.42) * envelope;
    z += Math.sin(progress * Math.PI * 3 + phase) * 0.66 * envelope;
    rotationY += direction * 0.18 * shear;
  } else if (motion === 'orbital-swap') {
    const lane = input.memoryIndex % 2 === 0 ? 1 : -1;
    const exchange = Math.sin(progress * Math.PI * 2 + lane * phase);
    x += lane * direction * (0.48 + amplitude * 0.18) * exchange * envelope;
    y += Math.cos(progress * Math.PI * 2 + phase) * 0.3 * envelope;
    z += Math.abs(exchange) * 0.58 * envelope;
    rotationZ += lane * direction * 0.16 * envelope;
  } else if (motion === 'cylinder-roll') {
    const roll = direction * (progress * Math.PI * 1.7 + phase);
    x += Math.sin(roll) * 0.68 * envelope;
    y += Math.cos(roll * 2 + phase) * 0.22 * envelope;
    z += Math.cos(roll) * 0.9 * envelope;
    rotationY += direction * 0.42 * envelope;
    rotationZ += Math.sin(roll) * 0.1 * envelope;
  } else if (motion === 'diagonal-sweep') {
    const sweep = Math.sin(progress * Math.PI);
    x += direction * (0.62 + amplitude * 0.24) * sweep;
    y += direction * (0.42 + amplitude * 0.18) * sweep;
    z += Math.sin(progress * Math.PI * 2 + phase) * 0.72 * sweep;
    rotationZ += direction * 0.22 * sweep;
  } else if (motion === 'blackhole-gather') {
    const radialLength = Math.max(0.5, Math.hypot(baseX, baseY));
    const gather = Math.sin(progress * Math.PI * 0.92);
    const spin = direction * progress * Math.PI * 2.5 + phase;
    x -= (baseX / radialLength) * (0.72 + amplitude * 0.28) * gather;
    y -= (baseY / radialLength) * (0.5 + amplitude * 0.2) * gather;
    z += 0.92 * gather + Math.sin(spin) * 0.44 * envelope;
    rotationY += direction * 0.3 * gather;
    scale *= 1 - 0.12 * gather;
  } else if (motion === 'sphere-pulse') {
    const pulse = Math.sin(progress * Math.PI * 2 + phase) * envelope;
    const latitude = Math.sin(baseY * 0.46 + phase);
    x += Math.cos(phase + progress * Math.PI * 2.2) * 0.36 * envelope;
    y += Math.sin(phase + progress * Math.PI * 1.8) * 0.28 * envelope;
    z += (0.78 + latitude * 0.32) * pulse;
    scale *= 1 + pulse * 0.045;
    rotationY += direction * 0.3 * envelope;
    rotationZ += pulse * 0.12;
  } else if (motion === 'star-ignite') {
    const arm = input.memoryIndex % 10;
    const burst = Math.sin(progress * Math.PI * 0.94);
    const armAngle = -Math.PI / 2 + arm * Math.PI / 5 + phase * 0.12;
    const thrust = (0.42 + amplitude * 0.5) * burst;
    x += Math.cos(armAngle) * thrust;
    y += Math.sin(armAngle) * thrust * 0.72;
    z += (0.5 + arm * 0.055) * burst;
    scale *= 1 + Math.abs(Math.sin(progress * Math.PI * 2 + phase)) * 0.06 * envelope;
    rotationZ += direction * 0.22 * burst;
  } else if (motion === 'torus-spin') {
    const spin = direction * (progress * Math.PI * 2.1 + phase);
    const tubePulse = Math.sin(spin + input.memoryIndex * 0.17) * envelope;
    x += Math.cos(spin) * 0.52 * envelope;
    y += Math.sin(spin) * 0.38 * envelope;
    z += Math.cos(spin * 1.4 + phase) * 0.76 * envelope + tubePulse * 0.22;
    rotationY += direction * 0.5 * envelope;
    rotationX += tubePulse * 0.18;
  } else if (motion === 'prism-fold') {
    const face = input.memoryIndex % 6;
    const fold = Math.sin(progress * Math.PI * 2 + face * Math.PI / 3 + phase);
    x += Math.cos(face * Math.PI / 3) * 0.42 * fold * envelope;
    y += Math.sin(progress * Math.PI * 2.4 + phase) * 0.34 * envelope;
    z += Math.abs(fold) * 0.88 * envelope;
    rotationY += direction * (0.28 + face * 0.025) * fold * envelope;
    rotationZ += direction * 0.1 * fold * envelope;
    scale *= 1 + Math.abs(fold) * 0.04 * envelope;
  } else if (motion === 'farewell-particle-gather') {
    const radialLength = Math.max(0.5, Math.hypot(baseX, baseY));
    const gather = clamp01((progress - 0.08) / 0.92);
    const fade = clamp01((progress - 0.42) / 0.58);
    x -= (baseX / radialLength) * (0.5 + amplitude * 0.38) * gather;
    y -= (baseY / radialLength) * (0.34 + amplitude * 0.26) * gather;
    z += 0.72 * gather + Math.sin(phase + progress * Math.PI * 2) * 0.36 * envelope;
    scale *= 1 - 0.24 * gather;
    opacity *= 1 - 0.88 * fade;
    rotationZ += direction * 0.18 * gather;
  } else {
    x += Math.cos(phase) * amplitude * 0.72 * envelope;
    y += Math.sin(phase) * amplitude * 0.46 * envelope;
    z += direction * 0.5 * envelope;
  }

  if (input.phase.camera === 'hero' && input.emphasis !== 'hero' && motion !== 'hero-reveal') {
    x *= 1 + 0.3 * envelope;
    y *= 1 + 0.22 * envelope;
    z -= 1.35 * envelope;
    scale *= 1 - 0.16 * envelope;
    opacity *= 1 - 0.38 * envelope;
  }

  // Only actual photo-surfaces share a group motion. Gravity, cascade, orbit,
  // helix and tunnel need their per-photo paths to remain visible; treating
  // every dense chapter as one surface was why the whole song read as the
  // same long-strip animation.
  const usesDenseSurfacePacking = (input.phase.visibleCount ?? 0) >= 30
    && (input.phase.layout === 'mosaic'
      || geometricSurfaceKind(input.phase) !== null
      || input.phase.layout === 'wave'
      || motion === 'cylinder-roll');

  // Dense scenes are a single photo surface, not 50 independent sprites.
  // Moving every card sideways by a different amount was the direct cause of
  // both collisions and the expensive frame-by-frame repair pass. Keep the
  // relative card spacing intact, while moving the whole surface and giving it
  // a tiny staggered vertical ripple. Depth, camera travel and card rotation
  // still make the surface read as a real 3D wave/cylinder/star rather than a
  // frozen contact sheet.
  if (usesDenseSurfacePacking) {
    const chapterPhase = seededUnit(input.phase.id, input.seed + 907) * Math.PI * 2;
    const sharedPulse = Math.sin(progress * Math.PI * 2 + chapterPhase) * envelope;
    const localRipple = Math.sin(
      progress * Math.PI * 2.4 + input.memoryIndex * 0.71 + chapterPhase,
    ) * 0.018 * envelope;
    let sharedX = Math.cos(progress * Math.PI + chapterPhase) * 0.11 * envelope;
    let sharedY = Math.sin(progress * Math.PI + chapterPhase) * 0.09 * envelope;

    if (motion === 'rain-drop') {
      const fall = input.incoming ? (1 - progress) ** 2.1 : 0;
      sharedX = Math.sin(chapterPhase) * 0.05 * envelope;
      sharedY = fall * 2.35 + Math.sin(progress * Math.PI) * 0.12;
    } else if (motion === 'wave-surface' || motion === 'wave-drift' || motion === 'afterglow-wave') {
      sharedY += sharedPulse * 0.22;
    } else if (motion === 'carousel' || motion === 'cylinder-roll' || motion === 'torus-spin') {
      sharedX += Math.sin(progress * Math.PI * 2 + chapterPhase) * 0.17 * envelope;
      sharedY += Math.cos(progress * Math.PI * 2 + chapterPhase) * 0.1 * envelope;
    }

    x = baseX + sharedX;
    y = baseY + sharedY + localRipple;
    // A photo-built volume must breathe as one object. Leaving the earlier
    // per-card pulse scale in place made an otherwise justified surface grow
    // into its neighbours midway through the chapter. Keep the depth and
    // normal rotation individual, but reserve card size for the shared form.
    scale = transform.scale * (1 + sharedPulse * 0.012);
  }

  return {
    position: [x, y, z],
    rotation: [
      rotationX + Math.sin(phase) * 0.045 * envelope,
      rotationY,
      rotationZ + direction * 0.09 * envelope,
    ],
    scale,
    opacity,
  };
}
