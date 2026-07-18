import type { ReactElement } from 'react'
import { Icon } from '@/components/primitives'

describe('Icon', () => {
  it('applies mask image, currentColor background, and default size', () => {
    const icon = Icon({ src: '/icons/close.svg' }) as ReactElement

    expect(icon.props['aria-hidden']).toBe('true')
    expect(icon.props.style.WebkitMaskImage).toBe('url(/icons/close.svg)')
    expect(icon.props.style.maskImage).toBe('url(/icons/close.svg)')
    expect(icon.props.style.maskSize).toBe('contain')
    expect(icon.props.style.maskRepeat).toBe('no-repeat')
    expect(icon.props.style.maskPosition).toBe('center')
    expect(icon.props.style.backgroundColor).toBe('currentColor')
    expect(icon.props.style.display).toBe('inline-block')
    expect(icon.props.style.width).toBe('1em')
    expect(icon.props.style.height).toBe('1em')
  })

  it('applies custom size and className', () => {
    const icon = Icon({
      src: '/icons/check.svg',
      size: '24px',
      className: 'text-info',
    }) as ReactElement

    expect(icon.props.className).toBe('text-info')
    expect(icon.props.style.width).toBe('24px')
    expect(icon.props.style.height).toBe('24px')
  })
})
