# ERC1155 Badges (non-transferable) for LP Token Providers 

## General Idea
Liquidity providers (of an arbitrary automated market making protocol) should be rewarded for long-term liquidity provision. Therefore they can stake their LP tokens in a smart contract that, over time, rewards them with honorable badges.

## Functional Requirements
- liquidity providers can stake their LP tokens
- after a certain time period has passed they can claim a non-transferable badge once
- the badge follows the multi-token standard (ERC1155)
- how long this time period takes should be dependent on the amount of staked tokens (large-scale LPs should get their badge faster)
- there are three badge levels, distinguishable by their metadata
- stakers first can claim a “level-1 badge” , if they continue to stake, they can at some point claim a “level-2 badge” and so forth
- every time a staker claims their badge from the next level they lose all badges from lower levels

## Local Deployment
Prerequisites: [Node (v16 LTS)](https://nodejs.org/en/download/) plus [Yarn](https://classic.yarnpkg.com/en/docs/install/) and [Git](https://git-scm.com/downloads)

> install and start the Hardhat chain:

```bash
yarn install
yarn chain
```

> in a second terminal window, start the frontend:

```bash
yarn start
```

> in a third terminal window, deploy the contracts:

```bash
yarn deploy
```

## Testnet Deployment 
> use a .env to specify an INFURA_PROJECT_ID and a DEPLOYER_PRIVATE_KEY, deploy the contracts:

```
yarn deploy --network [network name]
```


## Address of tesnet Deployment 
Deployed on Rinkeby @: 0xE5bA073a482ebd75DFbE8a0A28Db6efAd89De49f


# Implementation Notes 


## Token Metadata
Token meta data for the three badges specified and hosted, as per eip-1155 https://eips.ethereum.org/EIPS/eip-1155#metadata
Badge 1: http://acro.ai/liquidity-provider-badges/api/token/0000000000000000000000000000000000000000000000000000000000000001.json
Badge 2: http://acro.ai/liquidity-provider-badges/api/token/0000000000000000000000000000000000000000000000000000000000000002.json
Badge 3: http://acro.ai/liquidity-provider-badges/api/token/0000000000000000000000000000000000000000000000000000000000000003.json


## Badge Earn Rate 
![\Large x=\frac{-b\pm\sqrt{b^2-4ac}}{2a}](https://latex.codecogs.com/svg.image?\sum_{1}^{n}(numDaysTimePeriod_{i}&space;*&space;numLpTokensStakedPeriod_{i})) 

Using this linear earn rate means that staking 100 tokens for 1 days, or 1 token for 100 days earn the same amount of progress towards a badge.  


## Nice to haves (not yet implemented)
- Garbage collection for accounts that have already collected their level 3 badge, and removed their stake -- prevent storage and thus costs accumulating 