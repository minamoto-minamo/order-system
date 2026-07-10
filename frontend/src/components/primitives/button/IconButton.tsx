import type { ButtonHTMLAttributes } from 'react'

export function IconButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={['tappable', 'border-none', className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}
