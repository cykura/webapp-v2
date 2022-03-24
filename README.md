# Cykura interface

## Eager load pools

1. Call usePools() when the token pair is selected. This will fetch and save the pools in `useState()`.
2. Pathway: usePools -> useV3SwapPools -> useAllV3Routes. This hook only needs currency in and currency out
  - Further pathway: useAllV3Routes -> useBestV3TradeExactIn -> useDerivedSwapInfo
3. Read currency IDs from `useSwapState`, then feed it in `useCurrency` to obtain currency

## Double call issue
1. On token change- swap/index.tsx -> useAllV3Routes
2. On input amount- swap/index.tsx -> useDerivedSwapInfo -> useBestV3TradeExactIn -> useAllV3Routes
  1. useDerivedSwapInfo gives trade output amount, accounts and selected currencies
  2. useBestV3TradeExactIn() takes input amount(with currency) and output currency
  3. The two currencies are passed to `useAllV3Routes()`

Resolved by calling useAllV3Routes in useDerivedSwapInfo(). The routes as passed as a param to useBestV3TradeExactIn()