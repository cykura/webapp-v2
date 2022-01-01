import { useEffect } from 'react'
import { useDarkModeManager } from 'state/user/hooks'

const backgroundRadialGradientElement = document.getElementById('background-radial-gradient')

export default function GradientUpdater(): null {
  const [darkMode] = useDarkModeManager()

  useEffect(() => {
    if (!backgroundRadialGradientElement) {
      return
    }
    const LightGradient = 'radial-gradient(50% 50% at 50% 10%, #8e5dbf2f 0%, rgba(255, 255, 255, 0) 100%)'
    const DarkGradient = 'radial-gradient(50% 50% at 50% 10%, #69D4BA2f 0%, rgba(255, 255, 255, 0) 100%)'
    backgroundRadialGradientElement.style.background = darkMode ? DarkGradient : LightGradient
  }, [darkMode])

  return null
}
