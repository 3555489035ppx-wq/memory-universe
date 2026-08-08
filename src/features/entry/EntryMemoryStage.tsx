import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface EntryMemoryFrame {
  id: string;
  title: string;
  date: string;
  location: string;
  description: string;
  image: string;
}

const frames: readonly [EntryMemoryFrame, ...EntryMemoryFrame[]] = [
  {
    id: 'demo-memory-001',
    title: '雨停后的路口',
    date: '2022.01.01',
    location: '城市 · 雨',
    description: '路面把商店的灯完整地倒映出来。',
    image: '/demo/photos/preview/memory-001.jpg',
  },
  {
    id: 'demo-memory-002',
    title: '窗边的早餐',
    date: '2022.01.01',
    location: '家 · 清晨',
    description: '我们没有说话，只听见杯子碰到木桌的声音。',
    image: '/demo/photos/preview/memory-002.jpg',
  },
  {
    id: 'demo-memory-003',
    title: '沿江散步',
    date: '2022.01.02',
    location: '江边 · 风',
    description: '风把一整天的喧闹吹得很远。',
    image: '/demo/photos/preview/memory-003.jpg',
  },
  {
    id: 'demo-memory-004',
    title: '晚班地铁',
    date: '2022.01.03',
    location: '地铁 · 夜',
    description: '最后一班车里，每个人都带着自己的光。',
    image: '/demo/photos/preview/memory-004.jpg',
  },
  {
    id: 'demo-memory-005',
    title: '第一次见海',
    date: '2023.07.18',
    location: '海边 · 夏',
    description: '那天的蓝，后来一直留在记忆里。',
    image: '/demo/photos/preview/memory-005.jpg',
  },
  {
    id: 'demo-memory-006',
    title: '旧书店二楼',
    date: '2024.11.09',
    location: '书店 · 午后',
    description: '翻到一页旧信时，时间突然有了重量。',
    image: '/demo/photos/preview/memory-006.jpg',
  },
];

export function EntryMemoryStage(): ReactNode {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = frames[activeIndex] ?? frames[0];
  const next = frames[(activeIndex + 1) % frames.length] ?? frames[0];
  const previous = frames[(activeIndex - 1 + frames.length) % frames.length] ?? frames[0];
  const activeDate = useMemo(() => active.date.slice(0, 4), [active.date]);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % frames.length);
    }, 5600);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="entry-stage" aria-label="记忆展映">
      <div className="entry-stage__visual">
        <div
          className="entry-stage__ambient"
          aria-hidden="true"
          style={{ backgroundImage: `url(${active.image})` }}
        />
        <div className="entry-stage__peek entry-stage__peek--previous" aria-hidden="true">
          <img src={previous.image} alt="" />
        </div>
        <div className="entry-stage__peek entry-stage__peek--next" aria-hidden="true">
          <img src={next.image} alt="" />
        </div>
        <figure className="entry-stage__frame">
          <img key={active.id} src={active.image} alt={active.title} />
          <figcaption>
            <span>
              {activeDate} / {active.location}
            </span>
            <strong>{active.title}</strong>
          </figcaption>
        </figure>
        <div className="entry-stage__counter" aria-live="polite">
          <span>{String(activeIndex + 1).padStart(2, '0')}</span>
          <span className="entry-stage__counter-rule" aria-hidden="true" />
          <span>{String(frames.length).padStart(2, '0')}</span>
        </div>
      </div>
      <div className="entry-stage__meta">
        <div>
          <p className="eyebrow">A MEMORY IN MOTION</p>
          <p>
            {active.date} · {active.location}
          </p>
          <p className="entry-stage__description">{active.description}</p>
        </div>
        <Link className="entry-stage__link" to={`/memory/${encodeURIComponent(active.id)}`}>
          进入这段记忆 <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <ol className="entry-timeline" aria-label="演示记忆时间线">
        {frames.map((frame, index) => (
          <li key={frame.id} className={index === activeIndex ? 'is-active' : undefined}>
            <button
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-current={index === activeIndex ? 'step' : undefined}
            >
              <span className="entry-timeline__dot" aria-hidden="true" />
              <span className="entry-timeline__date">{frame.date}</span>
              <span className="entry-timeline__title">{frame.title}</span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
