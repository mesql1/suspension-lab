import { useEffect, useRef, useState } from 'react'

export function useCanvasSize() {
  const ref = useRef(null)
  const [size, setSize] = useState({ width: 300, height: 180, dpr: 1 })

  useEffect(() => {
    if (!ref.current) return undefined
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(1, Math.floor(entry.contentRect.width))
      const height = Math.max(1, Math.floor(entry.contentRect.height))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      setSize({ width, height, dpr })
    })
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return [ref, size]
}
