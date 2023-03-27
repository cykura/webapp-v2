# Cykura interface

## Phantom fix

- Yarn would not build due to lot of legacy dependencies. Fixed by adding `resolutions` in package.json
- Phantom window API is updated. Connect listener array is not empty by default, so the check had to be removed- https://github.com/cykura/saber-common/commit/f081c239307590e61f91e0538e1ecd99e83e2da6#diff-1dea9b9e824f7c7aedc4f24fc2b7126af7b0dce8a63d78d5d376553067621048L66
- New use-solana package is installed from a tarball

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