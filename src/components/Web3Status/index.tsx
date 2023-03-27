import { useWalletKit } from '@gokiprotocol/walletkit'
import { useSolana, useConnectedWallet } from '@saberhq/use-solana'
import { darken } from 'polished'

import styled, { css } from 'styled-components/macro'
import { ButtonSecondary } from '../Button'
import { RowBetween } from '../Row'
import { useModalOpen, useToggleModal } from '../../state/application/hooks'
import { useRef, useEffect } from 'react'
import { ApplicationModal } from 'state/application/actions'
import { useOnClickOutside } from '../../hooks/useOnClickOutside'
import { LogOut, Clipboard } from 'react-feather'
import { useSnackbar } from 'notistack'

export enum FlyoutAlignment {
  LEFT = 'LEFT',
  RIGHT = 'RIGHT',
}

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
  background-color: ${({ theme }) => theme.primary2};
  border: 2px solid ${({ theme }) => theme.primary2};
  color: ${({ theme }) => theme.text5};
  font-weight: 500;

  :hover,
  :focus {
    border: 2px solid ${({ theme }) => darken(0.05, theme.primary1)};
    background-color: ${({ theme }) => theme.primary1};
  }

  ${({ faded }) =>
    faded &&
    css`
      background-color: ${({ theme }) => theme.primary2};
      border: 2px solid ${({ theme }) => theme.primary2};
      color: ${({ theme }) => theme.text5};

      :hover,
      :focus {
        border: 2px solid ${({ theme }) => darken(0.05, theme.primary1)};
        background-color: ${({ theme }) => theme.primary1};
        color: ${({ theme }) => darken(0.05, theme.text5)};
      }
    `}
`

const IconWrapper = styled.div<{ size?: number }>`
  ${({ theme }) => theme.flexColumnNoWrap};
  align-items: center;
  justify-content: center;
  & > * {
    height: ${({ size }) => (size ? size + 'px' : '32px')};
    width: ${({ size }) => (size ? size + 'px' : '32px')};
  }
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

const StyledMenu = styled.div`
  margin-left: 0.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
  border: none;
  text-align: left;
`

const MenuFlyout = styled.span<{ flyoutAlignment?: FlyoutAlignment }>`
  min-width: 8.125rem;
  background-color: ${({ theme }) => theme.bg2};
  box-shadow: 0px 0px 1px rgba(0, 0, 0, 0.01), 0px 4px 8px rgba(0, 0, 0, 0.04), 0px 16px 24px rgba(0, 0, 0, 0.04),
    0px 24px 32px rgba(0, 0, 0, 0.01);
  border-radius: 12px;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  font-size: 1rem;
  position: absolute;
  top: 3rem;
  z-index: 100;
  ${({ flyoutAlignment = FlyoutAlignment.RIGHT }) =>
    flyoutAlignment === FlyoutAlignment.RIGHT
      ? css`
          right: 0rem;
        `
      : css`
          left: 0rem;
        `};
  ${({ theme }) => theme.mediaWidth.upToMedium`
    top: unset;
    bottom: 3em
  `};
`

const MenuItem = styled.div`
  display: flex;
  flex: 1;
  flex-direction: row;
  align-items: center;
  padding: 0.5rem 0.5rem;
  color: ${({ theme }) => theme.text2};
  :hover {
    color: ${({ theme }) => theme.text1};
    cursor: pointer;
    text-decoration: none;
  }
  > svg {
    margin-right: 8px;
  }
`

function Web3StatusInner() {
  const { enqueueSnackbar } = useSnackbar()
  const { connect } = useWalletKit()
  const { disconnect, connected, walletProviderInfo } = useSolana()
  const wallet = useConnectedWallet()
  const ICON = walletProviderInfo?.icon

  // @ts-ignore
  const oldProvider = window.solana
  // @ts-ignore
  const newProvider = window.phantom?.solana

  // Both return true for isConnected
  // console.log('old connected', oldProvider?.isConnected)
  console.log('new connected', newProvider?.isConnected)

  console.log('connect listeners', newProvider?.listeners('connect'))
  console.log('disconnect listeners', newProvider?.listeners('disconnect'))
  // newProvider?.on('connect', () => {
  //   console.log('connect callback')
  // })
  const node = useRef<HTMLDivElement>()
  const open = useModalOpen(ApplicationModal.MENU)
  const toggle = useToggleModal(ApplicationModal.MENU)
  useOnClickOutside(node, open ? toggle : undefined)

  const copyToClipboard = (txt: string) => {
    navigator.clipboard.writeText(txt)
    // enqueueSnackbar('Address Copied', {
    //   variant: 'success',
    // })
  }

  useEffect(() => {
    if (connected) {
      enqueueSnackbar('Wallet connected', {
        variant: 'success',
        preventDuplicate: true,
      })
    }
    wallet?.on('disconnect', () => {
      enqueueSnackbar('Wallet disconnected', {
        variant: 'info',
        preventDuplicate: true,
      })
    })
  }, [connected])

  return !connected ? (
    <Web3StatusConnect id="connect-wallet" onClick={connect} faded={false}>
      <Text>
        <span>Connect</span>
      </Text>
    </Web3StatusConnect>
  ) : (
    <RowBetween>
      {ICON && (
        <IconWrapper size={24}>
          {/* <img src={} alt={'WalletConnect'} /> */}
          {/* {walletProviderInfo?.icon} */}
          <ICON />
        </IconWrapper>
      )}
      <StyledMenu ref={node as any}>
        <Web3StatusConnect id="connect-wallet" onClick={toggle} faded={true}>
          <Text>
            <span>
              {wallet?.publicKey?.toString().slice(0, 4) ?? ''}...{wallet?.publicKey?.toString().slice(-4) ?? ''}
            </span>
          </Text>
        </Web3StatusConnect>

        {open && (
          <MenuFlyout>
            <MenuItem onClick={disconnect}>
              <LogOut size={14} />
              <div>
                <span>Disconnect</span>
              </div>
            </MenuItem>
            <MenuItem onClick={() => copyToClipboard(wallet?.publicKey.toString() ?? '')}>
              <Clipboard size={14} />
              <div>
                <span>Copy Address</span>
              </div>
            </MenuItem>
          </MenuFlyout>
        )}
      </StyledMenu>
    </RowBetween>
  )
}

export default function Web3Status() {
  return <Web3StatusInner />
}
