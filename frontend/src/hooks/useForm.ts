import { useCallback, useState } from 'react'

export function useForm<T extends Record<string, unknown>>(initialValues: T) {
  const [values, setValues] = useState<T>(initialValues)
  const [error, setError] = useState<string | null>(null)

  const setValue = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const reset = useCallback(
    (next?: T) => {
      setValues(next ?? initialValues)
      setError(null)
    },
    [initialValues],
  )

  return { values, setValue, reset, error, setError }
}
