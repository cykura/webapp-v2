import { Token, Currency } from '@cykura/sdk-core'
import styled from 'styled-components/macro'
import { TYPE, CloseIcon } from 'theme'
import Card from 'components/Card'
import { AutoColumn } from 'components/Column'
import { RowBetween } from 'components/Row'
import CurrencyLogo from 'components/CurrencyLogo'
import { ArrowLeft, AlertCircle } from 'react-feather'
import useTheme from 'hooks/useTheme'
import { ButtonPrimary } from 'components/Button'
import { SectionBreak } from 'components/swap/styleds'
import { useAddUserToken } from 'state/user/hooks'
import { useActiveWeb3ReactSol } from 'hooks/web3'
import { ExternalLink } from '../../theme/components'
import { ExplorerDataType, getExplorerLink } from '../../utils/getExplorerLink'
import { PaddedColumn } from './styleds'
import { useSolana } from '@saberhq/use-solana'

const Wrapper = styled.div`
  position: relative;
  width: 100%;
  overflow: auto;
`

const AddressText = styled(TYPE.blue)`
  font-size: 12px;

  ${({ theme }) => theme.mediaWidth.upToSmall`
    font-size: 10px;
`}
`

interface ImportProps {
  tokens: Token[]
  onBack?: () => void
  onDismiss?: () => void
  handleCurrencySelect?: (currency: Currency) => void
}

export function ImportToken({ tokens, onBack, onDismiss, handleCurrencySelect }: ImportProps) {
  const theme = useTheme()

  const { chainId } = useActiveWeb3ReactSol()
  const { network } = useSolana()

  const addToken = useAddUserToken()

  return (
    <Wrapper>
      <PaddedColumn gap="14px" style={{ width: '100%', flex: '1 1' }}>
        <RowBetween>
          {onBack ? <ArrowLeft style={{ cursor: 'pointer' }} onClick={onBack} /> : <div />}
          <TYPE.mediumHeader>
            <span>Import tokens</span>
          </TYPE.mediumHeader>
          {onDismiss ? <CloseIcon onClick={onDismiss} /> : <div />}
        </RowBetween>
      </PaddedColumn>
      <SectionBreak />
      <AutoColumn gap="md" style={{ marginBottom: '32px', padding: '1rem' }}>
        <AutoColumn justify="center" style={{ textAlign: 'center', gap: '16px', padding: '1rem' }}>
          <AlertCircle size={48} stroke={theme.text2} strokeWidth={1} />
          <TYPE.body fontWeight={400} fontSize={16}>
            <span>
              This token doesn&apos;t appear on the active token list(s). Make sure this is the token that you want to
              trade.
            </span>
          </TYPE.body>
        </AutoColumn>
        {tokens.map((token) => {
          return (
            <Card
              backgroundColor={theme.bg2}
              key={'import' + token.address}
              className=".token-warning-container"
              padding="2rem"
            >
              <AutoColumn gap="10px" justify="center">
                <CurrencyLogo currency={token} size={'32px'} />

                <AutoColumn gap="4px" justify="center">
                  <TYPE.body ml="8px" mr="8px" fontWeight={500} fontSize={20}>
                    {token.symbol}
                  </TYPE.body>
                  <TYPE.darkGray fontWeight={400} fontSize={14}>
                    {token.name}
                  </TYPE.darkGray>
                </AutoColumn>
                {chainId && (
                  <ExternalLink href={getExplorerLink(network, token.address.toString(), ExplorerDataType.ADDRESS)}>
                    <AddressText fontSize={12}>{token.address.toString()}</AddressText>
                  </ExternalLink>
                )}
              </AutoColumn>
            </Card>
          )
        })}

        <ButtonPrimary
          altDisabledStyle={true}
          $borderRadius="20px"
          padding="10px 1rem"
          onClick={() => {
            tokens.map((token) => addToken(token))
            handleCurrencySelect && handleCurrencySelect(tokens[0])
          }}
          className=".token-dismiss-button"
        >
          <span>Import</span>
        </ButtonPrimary>
      </AutoColumn>
    </Wrapper>
  )
}
