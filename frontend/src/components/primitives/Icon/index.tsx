import type { CSSProperties } from 'react'

interface IconProps {
  src: string
  size?: CSSProperties['width']
  className?: string
}

export function Icon({ src, size = '1em', className = '' }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        backgroundColor: 'currentColor',
        display: 'inline-block',
        width: size,
        height: size,
      }}
    />
  )
}
