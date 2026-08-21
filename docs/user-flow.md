# Memory Universe User Flow

## Public Demo flow

```mermaid
flowchart TD
  A[Open Demo] --> B[Choose 那年夏天]
  B --> C[Load 96 local demo photos]
  C --> D[Load local soundtrack]
  D --> E[Enter 3D memory universe]
  E --> F[Switch observation mode]
  F --> G[Memory Dive / Constellation / Replay]
```

## Personal flow

```mermaid
flowchart LR
  A[Import photos] --> B[Process EXIF and previews]
  B --> C[Review archive]
  C --> D[Organize by time / people / place / emotion]
  D --> E[Choose template and music]
  E --> F[Explore and edit]
  F --> G[Backup or export]
```

## Future AI contract

| Step | AI boundary | Human control |
| --- | --- | --- |
| Input | photos, EXIF, notes, music preference | choose what enters the flow |
| Context | time, people, place, emotion, theme | correct or remove context |
| Processing | cluster, summarize, suggest relationships and pacing | inspect confidence and source |
| Output | tags, story blocks, template suggestions | confirm, edit, reject, regenerate |
| Persistence | save AI metadata separately from originals | undo or reorganize later |

## Failure states

- WebGL unavailable: show a compatible static browsing mode.
- Demo asset load failure: keep a retry action and avoid a blank page.
- Music connector offline: fall back to the bundled local soundtrack.
- AI result insufficient: preserve original content and return to manual organization.
- Export lacks local audio: explain why remote audio cannot be written into a local export.
