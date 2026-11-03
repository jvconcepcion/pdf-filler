"use client";

import { useEffect, useRef } from "react";

/*
  Renders a signature PNG Blob scaled to fit without distortion (object-contain).
  The object URL is created in an effect and revoked on unmount or when the Blob
  changes, so nothing leaks.
*/
export function SignatureImage({ blob, className }: { blob: Blob; className?: string }) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (!img) return;
    const url = URL.createObjectURL(blob);
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={ref} alt="" className={className} />;
}
