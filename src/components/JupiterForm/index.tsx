import React, { FunctionComponent, useEffect, useMemo, useState } from 'react'
import { useSolana } from '@saberhq/use-solana'
import { TOKEN_LIST_URL, useJupiter } from '@jup-ag/react-hook'
import { PublicKey } from '@solana/web3.js'
import { TokenInfo } from '@solana/spl-token-registry'
import { INPUT_MINT_ADDRESS, OUTPUT_MINT_ADDRESS } from 'constants/jup'

interface IJupiterFormProps {}
type UseJupiterProps = Parameters<typeof useJupiter>[0]

const SECOND_TO_REFRESH = 30

const JupiterForm: FunctionComponent<IJupiterFormProps> = (props) => {
  const { connection, wallet } = useSolana()
  const [tokenMap, setTokenMap] = useState<Map<string, TokenInfo>>(new Map())

  const [formValue, setFormValue] = useState<UseJupiterProps>({
    amount: 1 * 10 ** 6, // unit in lamports (Decimals)
    inputMint: new PublicKey(INPUT_MINT_ADDRESS),
    outputMint: new PublicKey(OUTPUT_MINT_ADDRESS),
    slippage: 1, // 0.1%
  })

  const [inputTokenInfo, outputTokenInfo] = useMemo(() => {
    return [tokenMap.get(formValue.inputMint?.toBase58() || ''), tokenMap.get(formValue.outputMint?.toBase58() || '')]
  }, [formValue.inputMint?.toBase58(), formValue.outputMint?.toBase58()])

  useEffect(() => {
    fetch(TOKEN_LIST_URL['mainnet-beta'])
      .then((res) => res.json())
      .then((tokens: TokenInfo[]) => {
        setTokenMap(
          tokens.reduce((map, item) => {
            map.set(item.address, item)
            return map
          }, new Map())
        )
      })
  }, [setTokenMap])

  const amountInDecimal = useMemo(() => {
    return formValue.amount * 10 ** (inputTokenInfo?.decimals || 1)
  }, [inputTokenInfo, formValue.amount])

  const { routeMap, allTokenMints, routes, loading, exchange, error, refresh, lastRefreshTimestamp } = useJupiter({
    ...formValue,
    amount: amountInDecimal,
  })

  const validOutputMints = useMemo(
    () => routeMap.get(formValue.inputMint?.toBase58() || '') || allTokenMints,
    [routeMap, formValue.inputMint?.toBase58()]
  )

  // ensure outputMint can be swapable to inputMint
  useEffect(() => {
    if (formValue.inputMint) {
      const possibleOutputs = routeMap.get(formValue.inputMint.toBase58())

      if (possibleOutputs && !possibleOutputs?.includes(formValue.outputMint?.toBase58() || '')) {
        setFormValue((val) => ({
          ...val,
          outputMint: new PublicKey(possibleOutputs[0]),
        }))
      }
    }
  }, [formValue.inputMint?.toBase58(), formValue.outputMint?.toBase58()])

  const [timeDiff, setTimeDiff] = useState(lastRefreshTimestamp)
  useEffect(() => {
    const intervalId = setInterval(() => {
      if (loading) return

      const diff = (new Date().getTime() - lastRefreshTimestamp) / 1000
      setTimeDiff((diff / SECOND_TO_REFRESH) * 100)

      if (diff >= SECOND_TO_REFRESH) {
        refresh()
      }
    }, 1000)
    return () => clearInterval(intervalId)
  }, [loading])

  return (
    <>
      <div>
        <div>
          <label htmlFor="inputMint">
            Input token
          </label>
          <select
            id="inputMint"
            name="inputMint"
            value={formValue.inputMint?.toBase58()}
            onChange={(e) => {
              const pbKey = new PublicKey(e.currentTarget.value)
              if (pbKey) {
                setFormValue((val) => ({
                  ...val,
                  inputMint: pbKey,
                }))
              }
            }}
          >
            {allTokenMints
              .map((tokenMint) => {
                const found = tokenMap.get(tokenMint)

                return (
                  <option key={tokenMint} value={tokenMint}>
                    {found ? found.symbol : tokenMint}
                  </option>
                )
              })
              .filter(Boolean)}
          </select>
        </div>

        <div>
          <label htmlFor="outputMint">
            Output token
          </label>
          <select
            id="outputMint"
            name="outputMint"
            value={formValue.outputMint?.toBase58()}
            onChange={(e) => {
              const pbKey = new PublicKey(e.currentTarget.value)
              if (pbKey) {
                setFormValue((val) => ({
                  ...val,
                  outputMint: pbKey,
                }))
              }
            }}
          >
            {validOutputMints.map((tokenMint) => {
              const found = tokenMap.get(tokenMint)

              return (
                <option key={tokenMint} value={tokenMint}>
                  {found ? found.symbol : tokenMint}
                </option>
              )
            })}
          </select>
        </div>

        <div>
          <label htmlFor="amount">
            Input Amount ({inputTokenInfo?.symbol})
          </label>
          <div className="mt-1">
            <input
              name="amount"
              id="amount"
              value={formValue.amount}
              type="text"
              pattern="[0-9]*"
              onInput={(e: any) => {
                let newValue = Number(e.target?.value || 0)
                newValue = Number.isNaN(newValue) ? 0 : newValue
                setFormValue((val) => ({
                  ...val,
                  amount: Math.max(newValue, 0),
                }))
              }}
            />
          </div>
        </div>

        <div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
          >
            {/* <SpinnerProgress percentage={timeDiff} sqSize={18} strokeWidth={2} /> */}
            <span>{loading ? 'Loading' : 'Refresh'}</span>
          </button>
        </div>

        <div>Total routes: {routes?.length}</div>

        {routes?.[0] &&
          (() => {
            const route = routes[0]
            return (
              <div>
                <div>Best route info : {route.marketInfos.map((info) => info.amm.label).join(' -> ')}</div>
                <div>
                  Output: {route.outAmount / 10 ** (outputTokenInfo?.decimals || 1)} {outputTokenInfo?.symbol}
                </div>
                {/* <FeeInfo route={route} /> */}
              </div>
            )
          })()}

        {error && <div>Error in Jupiter, try changing your intput</div>}

        <div>
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              if (
                !loading &&
                routes?.[0] && wallet &&
                wallet.signAllTransactions &&
                wallet.signTransaction &&
                // wallet.sendTransaction &&
                wallet.publicKey
              ) {
                const swapResult = await exchange({
                  wallet: {
                    sendTransaction: (wallet as any).sendTransaction,
                    publicKey: wallet.publicKey,
                    signAllTransactions: wallet.signAllTransactions,
                    signTransaction: wallet.signTransaction,
                  },
                  routeInfo: routes[0],
                  onTransaction: async (txid) => {
                    console.log('sending transaction', txid)
                  },
                })

                console.log({ swapResult })

                if ('error' in swapResult) {
                  console.log('Error:', swapResult.error)
                } else if ('txid' in swapResult) {
                  console.log('Sucess:', swapResult.txid)
                  console.log('Input:', swapResult.inputAmount)
                  console.log('Output:', swapResult.outputAmount)
                }
              }
            }}
          >
            Swap Best Route
          </button>
        </div>
      </div>
    </>
  )
}

export default JupiterForm
