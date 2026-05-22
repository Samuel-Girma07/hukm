'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState } from 'react';

import { HukmMark } from './HukmMark';

const MetallicPaint = dynamic(() => import('./MetallicPaint'), { ssr: false });

interface HukmMarkMetallicProps {
  size?: number;
  className?: string;
}

export function HukmMarkMetallic({
  size = 32,
  className = '',
}: HukmMarkMetallicProps): React.ReactElement {
  const [isDesktop, setIsDesktop] = useState(false);
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsDesktop(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', onChange);

    // Check WebGL2 support
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      setWebglOk(!!gl);
    } catch {
      setWebglOk(false);
    }

    return () => mq.removeEventListener('change', onChange);
  }, []);

  if (!isDesktop || !webglOk) {
    return <HukmMark size={size} className={className} />;
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-[8px] overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Suspense fallback={<HukmMark size={size} className={className} />}>
        <MetallicPaint
          imageSrc="/logo-metal.svg"
          seed={42}
          scale={6}
          patternSharpness={1.2}
          noiseScale={0.6}
          speed={0.25}
          liquid={0.6}
          mouseAnimation={false}
          brightness={1.8}
          contrast={0.7}
          refraction={0.012}
          blur={0.012}
          chromaticSpread={1.8}
          fresnel={1.2}
          angle={15}
          waveAmplitude={0.8}
          distortion={0.8}
          contour={0.15}
          lightColor="#e0f7ff"
          darkColor="#0a1a2a"
          tintColor="#5AC8FA"
          className="h-full w-full"
        />
      </Suspense>
    </span>
  );
}
