# Cykura interface

## Deps update issue

- On updating `@gokiprotocol/walletkit`

```sh
./node_modules/@react-spring/web/dist/esm/index.js 123:9
Module parse failed: Unexpected token (123:9)
File was processed with these loaders:
 * ./node_modules/react-scripts/node_modules/babel-loader/lib/index.js
You may need an additional loader to handle the result of these loaders.
|   }
|
>   _value = null;
|
|   get() {
```

  - Adding `@babel/plugin-proposal-nullish-coalescing-operator` didn't work
  - Downgrading Goki didn't work. This is a dependency problem.
  - Try clean yarn install

- Fresh install

  - Can't find `@ledgerhq/devices/hid-framing`. This comes from `@ledgerhq/hw-transport-webusb` > `@saberhq/use-solana`

  ```
  ./node_modules/@ledgerhq/hw-transport-webusb/lib-es/TransportWebUSB.js
  Module not found: Can't resolve '@ledgerhq/devices/hid-framing' in '/home/pc/Documents/cykura/webapp-v2/node_modules/@ledgerhq/hw-transport-webusb/lib-es'
  ```

  - Removed `@saberhq/use-solana`, now `@gokiprotocol/walletkit` asks for it

  - Clean installing both gives `@react-spring/web` error for ` _value = null`

  - Goki uses `@react-spring/web` version `9.4.5`, whereas we use `react-spring` `8.0.27`.

  ```
  ./node_modules/@react-spring/web/dist/esm/index.js 113:11
  Module parse failed: Unexpected token (113:11)
  File was processed with these loaders:
  * ./node_modules/react-scripts/node_modules/babel-loader/lib/index.js
  You may need an additional loader to handle the result of these loaders.
  |       this.transforms = i;
  |     }
  >     _value = null;
  |     get() {
  |       return this._value || (this._value = this._get());

  ```

  - Migrating to latest `react-scripts` throws type errors.


- `@types/react-redux` has an unpinned react version. It fetches `18.0.29` despite resolution set to `17.0.2`


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