import { ButtonGray, ButtonOutlined } from 'components/Button'
import styled from 'styled-components/macro'
import { useConnectedWallet, useSolana } from '@saberhq/use-solana'
import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } from '@solana/web3.js'
import { Token, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { useCallback } from 'react'
import { useSnackbar } from 'notistack'
import { ExternalLink, TYPE } from 'theme'

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
  background-color: ${({ theme }) => theme.bg3};
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
    166, 35, 198, 106, 198, 244, 143, 224, 64, 125, 232, 144, 28, 45, 178, 146, 56, 92, 99, 244, 25, 75, 104, 247, 215,
    33, 62, 30, 186, 249, 163, 48, 185, 210, 115, 123, 192, 235, 130, 28, 35, 27, 9, 65, 38, 210, 100, 190, 62, 225, 55,
    90, 209, 0, 227, 160, 141, 54, 132, 242, 98, 240, 212, 95,
  ])
)

const USDC = {
  symbol: 'USDC',
  address: new PublicKey('GyH7fsFCvD1Wt8DbUGEk6Hzt68SVqwRKDHSvyBS16ZHm'),
  decimal: 6,
  name: 'USD Coin',
  logoURI:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
}
const USDT = {
  symbol: 'USDT',
  address: new PublicKey('7HvgZSj1VqsGADkpb8jLXCVqyzniDHP5HzQCymHnrn1t'),
  decimal: 6,
  name: 'Tether USD',
  logoURI:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
}
const CYS = {
  symbol: 'CYS',
  address: new PublicKey('cxWg5RTK5AiSbBZh7NRg5btsbSrc8ETLXGf7tk3MUez'),
  decimal: 6,
  name: 'Cyclos',
  logoURI:
    'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/BRLsMczKuaR5w9vSubF4j8HwEGGprVAyyVgS4EX7DKEg/logo.svg',
}

function Faucet() {
  const { enqueueSnackbar } = useSnackbar()
  const { connection } = useSolana()
  const wallet = useConnectedWallet()

  const requestAirdrop = useCallback(async () => {
    if (wallet?.publicKey) {
      connection
        .getBalance(wallet.publicKey)
        .then((b) => {
          if (b < 0.05 * 1e9) {
            connection.requestAirdrop(wallet.publicKey, 0.1 * 1e9).then((d) => {
              enqueueSnackbar('Airdroped 0.1 SOL', {
                variant: 'success',
              })
            })
          }
        })
        .catch((err) => {
          enqueueSnackbar(err, {
            variant: 'error',
          })
        })

      const tokensAddresses: PublicKey[] = [USDC.address, USDT.address, CYS.address]
      const collateralsQuantities: number[] = [
        100 * 10 ** USDC.decimal,
        100 * 10 ** USDT.decimal,
        100 * 10 ** CYS.decimal,
      ]

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
                wallet.publicKey
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
        enqueueSnackbar('Transaction Sent', {
          variant: 'info',
          action: (
            <ExternalLink href={`https://solscan.io/tx/${txHash}?cluster=devnet`}>
              <TYPE.link color="white">View on Explorer</TYPE.link>
            </ExternalLink>
          ),
        })
      } catch (err: any) {
        enqueueSnackbar(err?.message, {
          variant: 'error',
        })
      }
    }
  }, [wallet, connection])

  return (
    <StyledMenuButton onClick={() => requestAirdrop()}>
      <Text>
        <span>Faucet</span>
      </Text>
    </StyledMenuButton>
  )
}

export default Faucet
