import type { ImgHTMLAttributes } from 'react';

type StaticImport = { src: string };

interface ImageStubProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string | StaticImport;
  priority?: boolean;
}

// next/image needs the Next.js runtime; browser tests only need a plain image.
export default function Image({ src, ...props }: ImageStubProps) {
  const imgProps = { ...props };
  delete imgProps.priority;
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- test stub, alt comes from props
  return <img src={typeof src === 'string' ? src : src.src} {...imgProps} />;
}
