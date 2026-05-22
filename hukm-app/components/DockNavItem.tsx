'use client';

import Link from "next/link";
import {
  motion,
  MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
  type SpringOptions,
  AnimatePresence,
} from 'motion/react';
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';

interface DockNavItemProps {
  href: string;
  label: string;
  active?: boolean;
  children: ReactNode;
  containerRef?: RefObject<HTMLDivElement | null>;
  baseItemSize?: number;
  magnification?: number;
  distance?: number;
  spring?: SpringOptions;
}

const DEFAULT_SPRING: SpringOptions = { mass: 0.1, stiffness: 150, damping: 12 };

export function DockNavItem({
  href,
  label,
  active = false,
  children,
  containerRef,
  baseItemSize = 44,
  magnification = 56,
  distance = 100,
  spring = DEFAULT_SPRING,
}: DockNavItemProps): React.ReactElement {
  const ref = useRef<HTMLAnchorElement>(null);
  const isHovered = useMotionValue(0);
  const [labelVisible, setLabelVisible] = useState(false);

  // Use a shared mouseY from the container, or track locally
  const mouseY = useMotionValue(Infinity);

  const mouseDistance = useTransform(mouseY, (val) => {
    if (val === Infinity) return Infinity;
    const rect = ref.current?.getBoundingClientRect() ?? {
      y: 0,
      height: baseItemSize,
    };
    return val - rect.y - baseItemSize / 2;
  });

  const targetSize = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [baseItemSize, magnification, baseItemSize]
  );
  const size = useSpring(targetSize, spring);

  // Listen to container mouse events if provided
  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      mouseY.set(e.clientY);
    };
    const handleMouseLeave = () => {
      mouseY.set(Infinity);
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [containerRef, mouseY]);

  // Label visibility tracking
  useEffect(() => {
    const unsubscribe = isHovered.on('change', (latest) => {
      setLabelVisible(latest === 1);
    });
    return () => unsubscribe();
  }, [isHovered]);

  return (
    <div className="relative flex items-center justify-center">
      <Link
        ref={ref}
        href={href}
        aria-current={active ? 'page' : undefined}
        aria-label={label}
        title={label}
        onMouseEnter={() => isHovered.set(1)}
        onMouseLeave={() => isHovered.set(0)}
        onFocus={() => isHovered.set(1)}
        onBlur={() => isHovered.set(0)}
      >
        <motion.div
          style={{
            width: size,
            height: size,
          }}
          className={`
            relative inline-flex items-center justify-center rounded-[12px]
            transition-colors duration-150
            ${active
              ? 'bg-[rgb(var(--surface-elevated))] text-on-surface'
              : 'text-on-surface-variant hover:bg-[rgb(var(--surface-overlay))] hover:text-on-surface'
            }
          `}
        >
          {children}
          {active ? (
            <span
              aria-hidden
              className="absolute -left-px top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r-full bg-[rgb(var(--accent-blue))]"
            />
          ) : null}
        </motion.div>
      </Link>

      {/* Tooltip label */}
      <AnimatePresence>
        {labelVisible && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.15 }}
            className="
              absolute left-full ml-2 w-fit whitespace-pre rounded-md
              border border-[rgb(var(--border-subtle))]
              bg-[rgb(var(--surface-elevated))] px-2 py-0.5
              text-xs text-on-surface shadow-md
            "
            role="tooltip"
            style={{ translateY: '-50%' }}
          >
            {label}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
