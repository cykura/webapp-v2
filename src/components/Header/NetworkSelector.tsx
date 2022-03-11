import { useSolana } from '@saberhq/use-solana'
import { SupportedChainId } from 'constants/chains'
import { useOnClickOutside } from 'hooks/useOnClickOutside'
import { useActiveWeb3ReactSol } from 'hooks/web3'
import { useCallback, useRef } from 'react'
import { ChevronDown } from 'react-feather'
import { useModalOpen, useToggleModal } from '../../state/application/hooks'
import { ApplicationModal } from '../../state/application/actions'
import styled from 'styled-components/macro'
import { MEDIA_WIDTHS } from 'theme'

const ActiveRowWrapper = styled.div`
  background-color: ${({ theme }) => theme.bg1};
  border-radius: 8px;
  cursor: pointer;
  padding: 8px;
  width: 100%;
`
const FlyoutHeader = styled.div`
  color: ${({ theme }) => theme.text2};
  font-weight: 400;
`
const FlyoutMenu = styled.div`
  align-items: flex-start;
  background-color: ${({ theme }) => theme.bg0};
  box-shadow: 0px 0px 1px rgba(0, 0, 0, 0.01), 0px 4px 8px rgba(0, 0, 0, 0.04), 0px 16px 24px rgba(0, 0, 0, 0.04),
    0px 24px 32px rgba(0, 0, 0, 0.01);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  font-size: 16px;
  overflow: auto;
  padding: 16px;
  position: absolute;
  top: 64px;
  width: 170px;
  z-index: 99;
  & > *:not(:last-child) {
    margin-bottom: 12px;
  }
  @media screen and (min-width: ${MEDIA_WIDTHS.upToSmall}px) {
    top: 50px;
  }
`
const FlyoutRow = styled.div<{ active: boolean }>`
  align-items: center;
  background-color: ${({ active, theme }) => (active ? theme.bg1 : 'transparent')};
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  font-weight: 500;
  justify-content: space-between;
  padding: 6px 8px;
  text-align: left;
  width: 100%;
`

const SelectorControls = styled.div<{ interactive: boolean }>`
  align-items: center;
  background-color: ${({ theme }) => theme.bg0};
  border: 2px solid ${({ theme }) => theme.bg0};
  border-radius: 16px;
  color: ${({ theme }) => theme.text1};
  cursor: ${({ interactive }) => (interactive ? 'pointer' : 'auto')};
  display: flex;
  font-weight: 500;
  justify-content: space-between;
  padding: 6px 8px;
`

const SelectorWrapper = styled.div`
  @media screen and (min-width: ${MEDIA_WIDTHS.upToSmall}px) {
    position: relative;
  }
`
const StyledChevronDown = styled(ChevronDown)`
  width: 16px;
`

function Row({
  targetChain,
  onSelectChain,
}: {
  targetChain: SupportedChainId
  onSelectChain: (targetChain: number) => void
}) {
  const { chainId } = useActiveWeb3ReactSol()
  if (!chainId) {
    return null
  }
  const active = chainId === targetChain

  let label = 'Mainnet'

  switch (targetChain) {
    case SupportedChainId.MAINNET_BETA: {
      label = 'Mainnet'
      break
    }
    case SupportedChainId.TESTNET: {
      label = 'Testnet'
      break
    }
    case SupportedChainId.DEVNET: {
      label = 'Devnet'
      break
    }
    case SupportedChainId.LOCALNET: {
      label = 'Localnet'
      break
    }
  }

  const rowContent = (
    <FlyoutRow onClick={() => onSelectChain(targetChain)} active={active}>
      <span>{label}</span>
    </FlyoutRow>
  )

  if (active) {
    return <ActiveRowWrapper>{rowContent}</ActiveRowWrapper>
  }
  return rowContent
}

export default function NetworkSelector() {
  const { chainId } = useActiveWeb3ReactSol()
  const node = useRef<HTMLDivElement>()
  const open = useModalOpen(ApplicationModal.NETWORK_SELECTOR)
  const toggle = useToggleModal(ApplicationModal.NETWORK_SELECTOR)
  useOnClickOutside(node, open ? toggle : undefined)

  const { setNetwork, network } = useSolana()

  let label = 'Mainnet'

  switch (network) {
    case 'mainnet-beta': {
      label = 'Mainnet'
      break
    }
    case 'testnet': {
      label = 'Testnet'
      break
    }
    case 'devnet': {
      label = 'Devnet'
      break
    }
    case 'localnet': {
      label = 'Localnet'
      break
    }
  }

  const handleChainSwitch = useCallback(
    (targetChain: number) => {
      switch (targetChain) {
        case 101: {
          setNetwork('mainnet-beta')
          break
        }
        case 102: {
          setNetwork('testnet')
          break
        }
        case 103: {
          setNetwork('devnet')
          break
        }
        case 104: {
          setNetwork('localnet')
          break
        }
        default: {
          setNetwork('mainnet-beta')
        }
      }
    },

    [toggle, chainId]
  )

  return (
    <SelectorWrapper ref={node as any}>
      <SelectorControls onClick={toggle} interactive>
        <span>{label}</span>
        <StyledChevronDown />
      </SelectorControls>
      {open && (
        <FlyoutMenu onMouseLeave={toggle}>
          <FlyoutHeader>
            <span>Select a network</span>
          </FlyoutHeader>
          <Row onSelectChain={handleChainSwitch} targetChain={SupportedChainId.MAINNET_BETA} />
          <Row onSelectChain={handleChainSwitch} targetChain={SupportedChainId.DEVNET} />
          <Row onSelectChain={handleChainSwitch} targetChain={SupportedChainId.LOCALNET} />
        </FlyoutMenu>
      )}
    </SelectorWrapper>
  )
}
