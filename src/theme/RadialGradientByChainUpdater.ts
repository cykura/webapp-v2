import { useActiveWeb3React } from 'hooks/web3'
import { useEffect } from 'react'
import { useDarkModeManager } from 'state/user/hooks'
import { SupportedChainId } from '../constants/chains'

const initialStyles = {
  width: '100vw',
  height: '100vh',
}
const backgroundResetStyles = {
  width: '100vw',
  height: '100vh',
}

type TargetBackgroundStyles = typeof initialStyles | typeof backgroundResetStyles

const backgroundRadialGradientElement = document.getElementById('background-radial-gradient')
const setBackground = (newValues: TargetBackgroundStyles) =>
  Object.entries(newValues).forEach(([key, value]) => {
    if (backgroundRadialGradientElement) {
      backgroundRadialGradientElement.style[key as keyof typeof backgroundResetStyles] = value
    }
  })

export default function RadialGradientByChainUpdater(): null {
  // const { chainId } = useActiveWeb3React()
  const [darkMode] = useDarkModeManager()
  // manage background color
  useEffect(() => {
    if (!backgroundRadialGradientElement) {
      return
    }
    setBackground(backgroundResetStyles)
    const LightGradient = 'radial-gradient(50% 50% at 50% 10%, #8e5dbf2f 0%, rgba(255, 255, 255, 0) 100%)'
    const DarkGradient = 'radial-gradient(50% 50% at 50% 10%, #69D4BA2f 0%, rgba(255, 255, 255, 0) 100%)'
    backgroundRadialGradientElement.style.background = darkMode ? DarkGradient : LightGradient

    // switch (chainId) {
    //   case SupportedChainId.ARBITRUM_ONE:
    //     setBackground(backgroundResetStyles)
    //     const arbitrumLightGradient = 'radial-gradient(150% 100% at 50% 0%, #CDE8FB 0%, #FCF3F9 50%, #FFFFFF 100%)'
    //     const arbitrumDarkGradient = 'radial-gradient(150% 100% at 50% 0%, #0A294B 0%, #221E30 50%, #1F2128 100%)'
    //     backgroundRadialGradientElement.style.background = darkMode ? arbitrumDarkGradient : arbitrumLightGradient
    //     break
    //   case SupportedChainId.OPTIMISM:
    //     setBackground(backgroundResetStyles)
    //     const optimismLightGradient = 'radial-gradient(150% 100% at 50% 0%, #FFFBF2 2%, #FFF4F9 53%, #FFFFFF 100%)'
    //     const optimismDarkGradient = 'radial-gradient(150% 100% at 50% 0%, #3E2E38 2%, #2C1F2D 53%, #1F2128 100%)'
    //     backgroundRadialGradientElement.style.background = darkMode ? optimismDarkGradient : optimismLightGradient
    //     break
    //   default:
    //     setBackground(initialStyles)
    //     const LightGradient = 'radial-gradient(50% 50% at 50% 10%, #69D4BA2f 0%, rgba(255, 255, 255, 0) 100%);'
    //     const DarkGradient = 'radial-gradient(50% 50% at 50% 10%, #8e5dbf2f 0%, rgba(255, 255, 255, 0) 100%);'
    //     backgroundRadialGradientElement.style.background = darkMode ? DarkGradient : LightGradient
    // }
  }, [darkMode])
  return null
}
