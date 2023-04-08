import { useConnectedWallet, useSolana } from '@saberhq/use-solana'
import { PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Token, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'

function useVerifyATA(tokens: string[]) {
  const { connection, providerMut } = useSolana()
  const wallet = useConnectedWallet()

  // imp for force state update
  const [haveAllATAs, setHaveAllATAs] = useState(true)
  const [reload, setReload] = useState(false)

  // making this state cause infinte rerender
  // gets updated on haveAllATAs change
  const tx = new Transaction()

  useEffect(() => {
    if (wallet?.publicKey) {
      ; (async () => {
        try {
          for (const [index, collateral] of tokens.entries()) {
            const ata = await Token.getAssociatedTokenAddress(
              ASSOCIATED_TOKEN_PROGRAM_ID,
              TOKEN_PROGRAM_ID,
              new PublicKey(collateral),
              wallet.publicKey
            )
            const accountInfo = await connection.getAccountInfo(ata)
            if (!accountInfo) {
              setHaveAllATAs(false)
              tx.instructions.push(
                Token.createAssociatedTokenAccountInstruction(
                  ASSOCIATED_TOKEN_PROGRAM_ID,
                  TOKEN_PROGRAM_ID,
                  new PublicKey(collateral),
                  ata,
                  wallet.publicKey,
                  wallet.publicKey
                )
              )
            }
          }
        } catch (err) {
          console.log(err)
        }
        return tx
      })()
    }
  }, [tokens, reload, wallet?.publicKey])

  const createATA = useCallback(async () => {
    if (!wallet?.publicKey) return

    tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash
    tx.feePayer = wallet?.publicKey

    const signedTx = await providerMut?.wallet.signTransaction(tx)
    const serializedTx = signedTx?.serialize()

    if (serializedTx !== undefined) {
      const hash = await providerMut?.connection.sendRawTransaction(serializedTx)
      setHaveAllATAs(true)
      setReload((p) => !p)
    }
  }, [tx, wallet?.publicKey])

  return {
    haveAllATAs,
    createATA,
  }
}

export default useVerifyATA
