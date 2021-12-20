import { useWalletKit } from '@gokiprotocol/walletkit'
import { useSolana } from '@saberhq/use-solana'
import { darken } from 'polished'
import { Trans } from '@lingui/macro'
import styled, { css } from 'styled-components/macro'
import { ButtonSecondary } from '../Button'

const Web3StatusGeneric = styled(ButtonSecondary)`
  ${({ theme }) => theme.flexRowNoWrap}
  width: 100%;
  align-items: center;
  padding: 0.5rem;
  border-radius: 12px;
  cursor: pointer;
  user-select: none;
  :focus {
    outline: none;
  }
`

const Web3StatusConnect = styled(Web3StatusGeneric)<{ faded?: boolean }>`
  background-color: ${({ theme }) => theme.primary4};
  border: none;
  color: ${({ theme }) => theme.primaryText1};
  font-weight: 500;

  :hover,
  :focus {
    border: 1px solid ${({ theme }) => darken(0.05, theme.primary4)};
    color: ${({ theme }) => theme.primaryText1};
  }

  ${({ faded }) =>
    faded &&
    css`
      background-color: ${({ theme }) => theme.primary5};
      border: 1px solid ${({ theme }) => theme.primary5};
      color: ${({ theme }) => theme.primaryText1};

      :hover,
      :focus {
        border: 1px solid ${({ theme }) => darken(0.05, theme.primary4)};
        color: ${({ theme }) => darken(0.05, theme.primaryText1)};
      }
    `}
`

const Text = styled.p`
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0 0.5rem 0 0.25rem;
  font-size: 1rem;
  width: fit-content;
  font-weight: 500;
`

function Web3StatusInner() {
  const { connect } = useWalletKit()
  const { disconnect, connected } = useSolana()

  return !connected ? (
    <Web3StatusConnect id="connect-wallet" onClick={connect} faded={false}>
      <Text>
        <Trans>Connect</Trans>
      </Text>
    </Web3StatusConnect>
  ) : (
    <Web3StatusConnect id="connect-wallet" onClick={disconnect} faded={true}>
      <Text>
        <Trans>Disconnect</Trans>
      </Text>
    </Web3StatusConnect>
  )
}

export default function Web3Status() {
  return <Web3StatusInner />
}
