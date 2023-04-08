import * as anchor from '@project-serum/anchor'
import { ASSOCIATED_TOKEN_PROGRAM_ID, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { PublicKey } from '@solana/web3.js'
import { createContext, useContext, useEffect, useState } from 'react'
import {
  TM_LOCK_POOL,
  TM_LOCK_POOL_SIGNER,
  TM_LOCK_STK_VAULT,
  CYS_MINT,
  NO_LOCK_POOL,
  NO_LOCK_POOL_SIGNER,
  NO_LOCK_REWARDS_VAULT,
  NO_LOCK_STK_VAULT,
  PoolType,
  STAKING_PROGRAM,
  TM_LOCK_REWARDS_VAULT,
} from '../constants/addresses'
import idl from '../constants/rewards.json'
import { ConnectedWallet, useConnectedWallet, useSolana } from '@saberhq/use-solana'

const PRECISION = new anchor.BN('18446744073709551615')

interface IProps {
  children: JSX.Element[] | JSX.Element
}

export const StakingContext = createContext({} as any)

export default function useStaking() {
  const values = useContext(StakingContext)
  return {
    ...values,
  }
}

export function StakingProvider(props: IProps) {
  const { connected: isConnected, connection, providerMut } = useSolana()
  const wallet = useConnectedWallet()
  const [ownerTokenAcc, setOwnerTokenAcc] = useState<any>()
  const [stakeAccountNoLock, setStakeAccountNoLock] = useState<any>()
  const [stakeAccount2mLock, setStakeAccount2mLock] = useState<any>()

  const [poolNoLockDetails, setPoolNoLockDetails] = useState<{
    poolAccount: any
    tvl: any
    apr: any
    paused: boolean
  }>({ poolAccount: null, tvl: null, apr: null, paused: false })
  const [pool2mLockDetails, setPool2mLockDetails] = useState<{
    poolAccount: any
    tvl: any
    apr: any
    paused: boolean
  }>({ poolAccount: null, tvl: null, apr: null, paused: false })

  // State for user stake account
  const [userAccountNoLock, setUserAccountNoLock] = useState<{
    account: PublicKey
    bump: number | null
  }>({ account: PublicKey.default, bump: null })
  const [userAccount2mLock, setUserAccount2mLock] = useState<{
    account: PublicKey
    bump: number | null
  }>({ account: PublicKey.default, bump: null })

  const [reloadNL, setReloadNL] = useState(false)
  const [reload2M, setReload2M] = useState(false)

  const provider = providerMut
  // const provider = new anchor.Provider(connection, wallet, {
  //   skipPreflight: true,
  // })
  const stakingProgram = provider !== null
    // @ts-ignore
    ? new anchor.Program(idl as anchor.Idl, STAKING_PROGRAM, provider)
    : undefined

  // fetch token Account
  useEffect(() => {
    if (isConnected && wallet !== null) {
      Token.getAssociatedTokenAddress(ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, CYS_MINT, wallet.publicKey)
        .then((acc) => {
          setOwnerTokenAcc(acc)
        })
        .catch((err) => {
          console.log(err)
        })
    }
    return () => {
      setOwnerTokenAcc(null)
    }
  }, [isConnected])

  // Fetch data for No lock pool
  useEffect(() => {
    ; (async () => {
      if (stakingProgram) {
        try {
          const poolAccountNoLock = (await stakingProgram.account.pool.fetch(NO_LOCK_POOL)) as any
          const tvlNoLock = await connection.getTokenAccountBalance(poolAccountNoLock?.stakingVault)
          const nr1 = parseInt(poolAccountNoLock?.rewardRate.toString()) * 365 * 86400
          const dr1 = parseInt(tvlNoLock.value.amount) === 0 ? 0 : parseInt(tvlNoLock.value.amount)
          const a = (nr1 / dr1) * 100
          setPoolNoLockDetails({
            poolAccount: poolAccountNoLock,
            tvl: tvlNoLock.value.uiAmount,
            apr: a.toFixed(2),
            paused: poolAccountNoLock.paused,
          })
        } catch (err) {
          console.error(err)
        }
      }

    })()
  }, [stakeAccountNoLock, reloadNL])

  // Fetch data for 2 2months lock pool
  useEffect(() => {
    ; (async () => {
      if (stakingProgram) {
        try {
          const poolAccount2mLock = (await stakingProgram.account.pool.fetch(TM_LOCK_POOL)) as any
          const tvl2mLock = await connection.getTokenAccountBalance(poolAccount2mLock?.stakingVault)
          const nr2 = parseInt(poolAccount2mLock?.rewardRate.toString()) * 365 * 86400
          const dr2 = parseInt(tvl2mLock.value.amount) === 0 ? 0 : parseInt(tvl2mLock.value.amount)
          const b = (nr2 / dr2) * 100
          setPool2mLockDetails({
            poolAccount: poolAccount2mLock,
            tvl: tvl2mLock.value.uiAmount,
            apr: b.toFixed(2),
            paused: poolAccount2mLock.paused,
          })
        } catch (err) {
          console.error(err)
        }
      }

    })()
  }, [stakeAccount2mLock, reload2M])

  // Fetch user account for No lock pool
  useEffect(() => {
    if (isConnected && wallet && stakingProgram) {
      ; (async () => {
        try {
          const [userAccount, userAccountBump] = await anchor.web3.PublicKey.findProgramAddress(
            [wallet.publicKey.toBuffer(), NO_LOCK_POOL.toBuffer()],
            STAKING_PROGRAM
          )

          setUserAccountNoLock({
            account: userAccount,
            bump: userAccountBump,
          })

          const exist = await connection.getBalance(userAccount)

          if (exist) {
            stakingProgram.account.user
              .fetch(userAccount)
              .then((acc) => {
                setStakeAccountNoLock(acc)
              })
              .catch((err) => {
                console.log(err)
              })
          }
        } catch (err) {
          console.log(err)
        }
      })()
    }
    return () => {
      if (!isConnected) {
        setStakeAccountNoLock(null)
      }
    }
  }, [isConnected, reloadNL])

  // Fetch user account for 2 months lock pool
  useEffect(() => {
    if (isConnected && wallet && stakingProgram) {
      ; (async () => {
        try {
          const [userAccount, userAccountBump] = await anchor.web3.PublicKey.findProgramAddress(
            [wallet.publicKey.toBuffer(), TM_LOCK_POOL.toBuffer()],
            STAKING_PROGRAM
          )
          setUserAccount2mLock({
            account: userAccount,
            bump: userAccountBump,
          })
          const exist = await connection.getBalance(userAccount)

          if (exist) {
            stakingProgram.account.user
              .fetch(userAccount)
              .then((acc) => {
                setStakeAccount2mLock(acc)
              })
              .catch((err) => {
                console.log(err)
              })
          }
        } catch (err) {
          console.log(err)
        }
      })()
    }
    return () => {
      if (!isConnected) {
        setStakeAccount2mLock(null)
      }
    }
  }, [isConnected, reload2M])

  const stake = async (input: number, poolType: PoolType) => {
    let POOL_ID = NO_LOCK_POOL
    let POOL_SIGNER = NO_LOCK_POOL_SIGNER
    let STAKING_VAULT = NO_LOCK_STK_VAULT
    let userAccount = userAccountNoLock

    // Switch Pools
    if (poolType === PoolType.TWOLOCK) {
      POOL_ID = TM_LOCK_POOL
      POOL_SIGNER = TM_LOCK_POOL_SIGNER
      STAKING_VAULT = TM_LOCK_STK_VAULT
      userAccount = userAccount2mLock
    }

    const exist = await connection.getBalance(userAccount.account)

    const amount = new anchor.BN(input * 1e6)
    let tx

    if (wallet && stakingProgram && providerMut) {
      if (!exist) {
        // Stake account does not exist
        const ix = stakingProgram.instruction.createUser(userAccount.bump, {
          accounts: {
            pool: POOL_ID,
            user: userAccount.account,
            owner: wallet.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          },
        })

        tx = stakingProgram.transaction.stake(amount, {
          accounts: {
            pool: POOL_ID,
            stakingVault: STAKING_VAULT,
            user: userAccount.account,
            owner: wallet.publicKey,
            stakeFromAccount: ownerTokenAcc,
            poolSigner: POOL_SIGNER,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
          instructions: [ix],
        })
      }
      else {
        tx = stakingProgram.transaction.stake(amount, {
          accounts: {
            pool: POOL_ID,
            stakingVault: STAKING_VAULT,
            user: userAccount.account,
            owner: wallet.publicKey,
            stakeFromAccount: ownerTokenAcc,
            poolSigner: POOL_SIGNER,
            tokenProgram: TOKEN_PROGRAM_ID,
          },
        })
      }

      // Manually add blockhash and sign
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      tx.feePayer = wallet?.publicKey

      const signedTx = await providerMut.wallet.signTransaction(tx)
      const serializedTx = signedTx.serialize()
      const hash = await providerMut.connection.sendRawTransaction(serializedTx)

      if (poolType === PoolType.NOLOCK) {
        stakingProgram.account.user
          .fetch(userAccount.account)
          .then((acc) => {
            setStakeAccountNoLock(acc)
          })
          .catch((err) => {
            console.log(err)
          })
      } else {
        stakingProgram.account.user
          .fetch(userAccount.account)
          .then((acc) => {
            setStakeAccount2mLock(acc)
          })
          .catch((err) => {
            console.log(err)
          })
      }
      return hash
    }

    return undefined
  }

  const unstake = async (input: number, poolType: PoolType) => {
    let POOL_ID = NO_LOCK_POOL
    let STAKING_VAULT = NO_LOCK_STK_VAULT
    let POOL_SIGNER = NO_LOCK_POOL_SIGNER
    let userAccount = userAccountNoLock

    // Switch Pools
    if (poolType === PoolType.TWOLOCK) {
      POOL_ID = TM_LOCK_POOL
      STAKING_VAULT = TM_LOCK_STK_VAULT
      POOL_SIGNER = TM_LOCK_POOL_SIGNER
      userAccount = userAccount2mLock
    }

    const amount = new anchor.BN(input * 1e6)

    if (wallet && stakingProgram && providerMut) {
      const tx = stakingProgram.transaction.unstake(amount, {
        accounts: {
          pool: POOL_ID,
          stakingVault: STAKING_VAULT,
          user: userAccount.account,
          owner: wallet.publicKey,
          stakeFromAccount: ownerTokenAcc,
          poolSigner: POOL_SIGNER,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      })
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
      tx.feePayer = wallet?.publicKey

      const signedTx = await providerMut.wallet.signTransaction(tx)
      const serializedTx = signedTx.serialize()
      const hash = await providerMut.connection.sendRawTransaction(serializedTx)

      if (poolType === PoolType.NOLOCK) {
        stakingProgram.account.user
          .fetch(userAccount.account)
          .then((acc) => {
            setStakeAccountNoLock(acc)
          })
          .catch((err) => {
            console.log(err)
          })
      } else {
        stakingProgram.account.user
          .fetch(userAccount.account)
          .then((acc) => {
            setStakeAccount2mLock(acc)
          })
          .catch((err) => {
            console.log(err)
          })
      }
      return hash
    }
    return undefined
  }

  const claim = async (poolType: PoolType) => {
    let POOL_ID = NO_LOCK_POOL
    let STAKING_VAULT = NO_LOCK_STK_VAULT
    let REWARD_VAULT = NO_LOCK_REWARDS_VAULT
    let POOL_SIGNER = NO_LOCK_POOL_SIGNER
    let userAccount = userAccountNoLock

    // Switch Pools
    if (poolType === PoolType.TWOLOCK) {
      POOL_ID = TM_LOCK_POOL
      STAKING_VAULT = TM_LOCK_STK_VAULT
      REWARD_VAULT = TM_LOCK_REWARDS_VAULT
      POOL_SIGNER = TM_LOCK_POOL_SIGNER
      userAccount = userAccount2mLock
    }

    if (wallet && stakingProgram) {

      const tx = stakingProgram.transaction.claim({
        accounts: {
          pool: POOL_ID,
          stakingVault: STAKING_VAULT,
          rewardVault: REWARD_VAULT,
          user: userAccount.account,
          owner: wallet.publicKey,
          rewardAccount: ownerTokenAcc,
          poolSigner: POOL_SIGNER,
          tokenProgram: TOKEN_PROGRAM_ID,
        },
      })
      tx.recentBlockhash = (await connection.getRecentBlockhash()).blockhash
      tx.feePayer = wallet?.publicKey

      const signedTx = await providerMut?.wallet.signTransaction(tx)
      const serializedTx = signedTx?.serialize()

      if (serializedTx) {
        const hash = await providerMut?.connection.sendRawTransaction(serializedTx)

        if (poolType === PoolType.NOLOCK) {
          stakingProgram.account.user
            .fetch(userAccount.account)
            .then((acc) => {
              setStakeAccountNoLock(acc)
            })
            .catch((err) => {
              console.log(err)
            })
        } else {
          stakingProgram.account.user
            .fetch(userAccount.account)
            .then((acc) => {
              setStakeAccount2mLock(acc)
            })
            .catch((err) => {
              console.log(err)
            })
        }
        return hash
      }
      return tx
    }
    return undefined
  }

  const getPendingReward = (poolType: PoolType) => {
    const stakeAccount = poolType === PoolType.NOLOCK ? stakeAccountNoLock : stakeAccount2mLock
    const poolDetails = poolType === PoolType.NOLOCK ? poolNoLockDetails : pool2mLockDetails

    if (
      stakeAccount &&
      Object.keys(stakeAccount).length &&
      poolDetails?.poolAccount &&
      Object.keys(poolDetails.poolAccount).length
    ) {
      const poolAccount = poolDetails.poolAccount
      const totalStaked = new anchor.BN(poolDetails.tvl * 1000000)
      const currentTime = Math.floor(Date.now() / 1000)
      const rewardDurationEnd = parseInt(poolAccount.rewardDurationEnd.toNumber())
      const lastTimeRewardApplicable = new anchor.BN(currentTime > rewardDurationEnd ? rewardDurationEnd : currentTime)

      let rewardPerTokenStored: anchor.BN = poolAccount.rewardPerTokenStored
      if (!totalStaked.isZero()) {
        rewardPerTokenStored = poolAccount.rewardPerTokenStored.add(
          lastTimeRewardApplicable
            .sub(poolAccount.lastUpdateTime)
            .mul(poolAccount.rewardRate)
            .mul(PRECISION)
            .div(totalStaked)
        )
      }
      const pendingAmount = stakeAccount.balanceStaked
        .mul(rewardPerTokenStored.sub(stakeAccount.rewardPerTokenComplete))
        .div(PRECISION)
        .add(stakeAccount.rewardPerTokenPending)
      return parseInt(pendingAmount) / 1000000 < 0 ? 0 : parseInt(pendingAmount) / 1000000
    } else {
      return 0
    }
  }

  const value = {
    stakingProgram,
    stake,
    unstake,
    claim,
    stakeAccountNoLock,
    stakeAccount2mLock,
    pool2mLockDetails,
    poolNoLockDetails,
    setReloadNL,
    setReload2M,
    getPendingReward,
  }

  return <StakingContext.Provider value={value}>{props.children}</StakingContext.Provider>
}
