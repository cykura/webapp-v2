import { Currency } from '@cykura/sdk-core'
import { SOL_ICON, CYS_ICON, USDC_ICON, USDT_ICON } from 'constants/tokens'
import React, { useMemo } from 'react'
import styled from 'styled-components/macro'
import useHttpLocations from '../../hooks/useHttpLocations'
import { WrappedTokenInfo } from '../../state/lists/wrappedTokenInfo'
import Logo from '../Logo'

export const getTokenLogoURL = (address: string) =>
  `https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/${address}/logo.png`

const WSOL_ICON =
  'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png'

const StyledSolanaLogo = styled.img<{ size: string }>`
  width: ${({ size }) => size};
  height: ${({ size }) => size};
  box-shadow: 0px 6px 10px rgba(0, 0, 0, 0.075);
  border-radius: 24px;
`

const StyledLogo = styled(Logo)<{ size: string }>`
  width: ${({ size }) => size};
  height: ${({ size }) => size};
  border-radius: ${({ size }) => size};
  box-shadow: 0px 6px 10px rgba(0, 0, 0, 0.075);
  background-color: ${({ theme }) => theme.black};
`

export default function CurrencyLogo({
  currency,
  size = '24px',
  style,
  ...rest
}: {
  currency?: Currency
  size?: string
  style?: React.CSSProperties
}) {
  const uriLocations = useHttpLocations(currency instanceof WrappedTokenInfo ? currency.logoURI : undefined)

  const srcs: string[] = useMemo(() => {
    if (!currency || currency.isNative) return []

    if (currency.isToken) {
      const defaultUrls = currency.chainId === 1 ? [getTokenLogoURL(currency.address)] : []
      if (currency instanceof WrappedTokenInfo) {
        return [...uriLocations, ...defaultUrls]
      }
      return defaultUrls
    }
    return []
  }, [currency, uriLocations])

  if (currency?.isNative) {
    return <StyledSolanaLogo src={WSOL_ICON} size={size} style={style} {...rest} />
  }
  const logo =
    currency?.symbol === 'USDC'
      ? USDC_ICON
      : currency?.symbol === 'USDT'
      ? USDT_ICON
      : currency?.symbol === 'wSOL'
      ? SOL_ICON
      : currency?.symbol === 'SOL'
      ? SOL_ICON
      : currency?.symbol === 'CYS'
      ? CYS_ICON
      : currency
      ? getTokenLogoURL(currency?.address)
      : ''

  return <StyledLogo size={size} srcs={[logo]} alt={`${currency?.symbol ?? 'token'} logo`} style={style} {...rest} />
}
