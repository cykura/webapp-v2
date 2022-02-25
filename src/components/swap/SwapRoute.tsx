import { Currency, TradeType } from '@uniswap/sdk-core'
import { Trade as V3Trade, FeeAmount } from '@uniswap/v3-sdk'
import { Fragment, memo, useContext } from 'react'
import { ChevronRight } from 'react-feather'
import { Flex } from 'rebass'
import { ThemeContext } from 'styled-components/macro'
import { TYPE } from '../../theme'
import { unwrappedToken } from 'utils/unwrappedToken'

function LabeledArrow({ fee }: { fee: FeeAmount }) {
  const theme = useContext(ThemeContext)

  // todo: render the fee in the label
  return (
    <>
      <ChevronRight size={14} color={theme.text2} />({fee / 10_000} %)
    </>
  )
}

export default memo(function SwapRoute({ trade }: { trade: V3Trade<Currency, Currency, TradeType> }) {
  const tokenPath = trade.route.tokenPath
  const fee = trade.route.pools[0].fee
  const theme = useContext(ThemeContext)
  return (
    <Flex flexWrap="wrap" width="100%" justifyContent="flex-start" alignItems="center">
      {tokenPath.map((token, i, path) => {
        const isLastItem: boolean = i === path.length - 1
        const currency = unwrappedToken(token)
        return (
          <Fragment key={i}>
            <Flex alignItems="end">
              <TYPE.black color={theme.text1} ml="0.145rem" mr="0.145rem">
                {currency.symbol}
              </TYPE.black>
            </Flex>
            {isLastItem && <LabeledArrow fee={fee} />}
          </Fragment>
        )
      })}
    </Flex>
  )
})
