import { Trans } from '@lingui/macro'
import { ButtonGray } from 'components/Button'
import styled from 'styled-components/macro'
import { useConnectedWallet, useSolana } from '@saberhq/use-solana'
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import { Token, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { useCallback } from 'react'

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
const StyledMenuButton = styled.button`
  position: relative;
  width: 100%;
  height: 100%;
  border: none;
  background-color: transparent;
  margin: 0;
  padding: 0;
  height: 35px;
  background-color: ${({ theme }) => theme.bg2};
  color: ${({ theme }) => theme.text1};
  margin-left: 8px;
  padding: 0.15rem 0.5rem;
  border-radius: 0.5rem;

  :hover {
    cursor: pointer;
    outline: none;
    background-color: ${({ theme }) => theme.bg4};
  }

  :active {
    background-color: ${({ theme }) => theme.bg2};
  }

  svg {
    margin-top: 2px;
  }
  > * {
    stroke: ${({ theme }) => theme.text1};
  }
`

const airdropAdmin = Keypair.fromSecretKey(
  Uint8Array.from([
    85, 51, 81, 126, 224, 250, 233, 174, 133, 40, 112, 237, 109, 244, 6, 62, 193, 121, 239, 246, 11, 77, 215, 9, 0, 18,
    83, 91, 115, 65, 112, 238, 60, 148, 118, 6, 224, 47, 54, 140, 167, 188, 182, 74, 237, 183, 242, 77, 129, 107, 155,
    20, 229, 130, 251, 93, 168, 162, 156, 15, 152, 163, 229, 119,
  ])
)

const USDC = {
  symbol: 'USDC',
  address: new PublicKey('5ihkgQGjKvWvmMtywTgLdwokZ6hqFv5AgxSyYoCNufQW'),
  decimal: 6,
  name: 'USD Coin',
  logoURI:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
}
const USDT = {
  symbol: 'USDT',
  address: new PublicKey('4cZv7KgYNgmr3NZSDhT5bhXGGttXKTndqyXeeC1cB6Xm'),
  decimal: 6,
  name: 'Theter USD',
  logoURI:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
}
const SOL = {
  symbol: 'wSOL',
  address: new PublicKey('BJVjNqQzM1fywLWzzKbQEZ2Jsx9AVyhSLWzko3yF68PH'),
  decimal: 9,
  name: 'Wrapped Solana',
  logoURI:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
}

function Faucet() {
  const { connection } = useSolana()
  const wallet = useConnectedWallet()

  const requestAirdrop = useCallback(async () => {
    if (wallet?.publicKey) {
      connection
        .getBalance(wallet.publicKey)
        .then((b) => {
          if (b < 0.05 * 1e9) {
            connection.requestAirdrop(wallet.publicKey, 0.1 * 1e9).then((d) => {
              console.log(d)
            })
          }
        })
        .catch((err) => {
          console.log(err)
        })

      const tokensAddresses: PublicKey[] = [USDC.address, USDT.address, SOL.address]
      const collateralsQuantities: number[] = [100 * 10 ** USDC.decimal, 100 * 10 ** USDT.decimal, 10 ** SOL.decimal]

      const instructions: TransactionInstruction[] = []
      try {
        for (const [index, collateral] of tokensAddresses.entries()) {
          const ata = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            collateral,
            wallet.publicKey
          )
          const accountInfo = await connection.getAccountInfo(ata)
          if (!accountInfo) {
            instructions.push(
              Token.createAssociatedTokenAccountInstruction(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                collateral,
                ata,
                wallet.publicKey,
                airdropAdmin.publicKey
              )
            )
          }
          instructions.push(
            Token.createMintToInstruction(
              TOKEN_PROGRAM_ID,
              collateral,
              ata,
              airdropAdmin.publicKey,
              [],
              collateralsQuantities[index]
            )
          )
        }

        const tx = instructions.reduce((tx, ix) => tx.add(ix), new Transaction())
        const blockhash = await connection.getRecentBlockhash()
        tx.feePayer = wallet.publicKey
        tx.recentBlockhash = blockhash.blockhash
        tx.sign(airdropAdmin)
        const signedTx = await wallet.signTransaction(tx)
        const txHash = await connection.sendRawTransaction(signedTx.serialize(), { skipPreflight: true })
        console.log(txHash)
      } catch (err) {
        console.log(err)
      }
    }
  }, [wallet, connection])

  return (
    <StyledMenuButton onClick={() => requestAirdrop()}>
      <Text>
        <Trans>Faucet</Trans>
      </Text>
    </StyledMenuButton>
  )
}

export default Faucet
