import { useEffect, useRef, useState } from 'react';

/** Slow-moving colour glow behind the page. */
export function Aurora() {
  return (
    <div className="aurora" aria-hidden="true">
      <i /><i /><i />
    </div>
  );
}

/** Fades its children up the first time they scroll into view. */
export function Reveal({ as: Tag = 'div', delay = 0, className = '', style, children, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    let timer;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.classList.add('in');
        observer.disconnect();
        // Drop the stagger delay once revealed so hover effects respond immediately.
        timer = setTimeout(() => { el.style.transitionDelay = '0ms'; }, delay + 900);
      }
    }, { threshold: 0.15 });
    observer.observe(el);
    return () => {
      observer.disconnect();
      clearTimeout(timer);
    };
  }, [delay]);

  return (
    <Tag ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms`, ...style }} {...rest}>
      {children}
    </Tag>
  );
}

/** Counts up to `value` once visible. */
export function CountUp({ value, duration = 1400 }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return undefined;
    }
    let frame;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        setShown(Math.round(value * (1 - (1 - t) ** 3)));
        if (t < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return <span ref={ref}>{shown}</span>;
}
