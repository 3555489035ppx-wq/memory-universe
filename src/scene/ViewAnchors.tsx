import { useMemo, type ReactNode } from 'react';

import { useSceneStore } from '../stores/sceneStore';

export function ViewAnchors(): ReactNode {
  const view = useSceneStore((state) => state.view);
  const mode = useSceneStore((state) => state.mode);
  const dataset = useSceneStore((state) => state.dataset);
  const hubFocusId = useSceneStore((state) => state.hubFocusId);
  const setHubFocus = useSceneStore((state) => state.setHubFocus);
  const hubs = useMemo(() => {
    if (mode !== 'universe' || view !== 'people' || !dataset) return [];
    const people = dataset.people.toSorted((left, right) => left.id.localeCompare(right.id));
    return people.map((person, index) => {
      const angle = (index / Math.max(1, people.length)) * Math.PI * 2;
      const count = dataset.memories.filter((memory) => memory.personIds.includes(person.id)).length;
      return {
        person,
        count,
        position: [Math.cos(angle) * 5, Math.sin(angle) * 3, Math.sin(angle * 2) * 1.5] as const,
      };
    });
  }, [dataset, mode, view]);

  if (mode !== 'universe' || view !== 'people') return null;
  return (
    <group>
      {hubs.map(({ person, count, position }) => {
        const active = hubFocusId === person.id;
        const radius = Math.min(0.48, 0.22 + count * 0.018);
        return (
          <mesh
            key={person.id}
            position={position}
            onClick={(event) => {
              event.stopPropagation();
              setHubFocus(active ? null : person.id);
            }}
          >
            <ringGeometry args={[radius * 0.72, radius, 36]} />
            <meshBasicMaterial
              color={active ? '#dfc58e' : '#8f887b'}
              opacity={active ? 0.86 : 0.32}
              transparent
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
