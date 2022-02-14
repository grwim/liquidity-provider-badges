const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");

use(solidity);

// Have I covered all the edge cases?
// Is the function reverting when expected?
// Is the function emitting the needed events?
// With a specific input, will the function produce the expected output? Will the new state of the Contract be shaped as we expect?
// Will the function returns (if it returns something) what we are expecting?
// Has the user’s wallet and contract’s wallet changed their value as expected after the transaction

// Utilities methods
const increaseWorldTimeInSeconds = async (seconds, mine = false) => {
    await ethers.provider.send('evm_increaseTime', [seconds]);
    if (mine) {
      await ethers.provider.send('evm_mine', []);
    }
  };    

describe("HonorBadge Contract", function () {
  let myContract;

  let owner;
  let addr1;
  let addr2;
  let addrs;

  let LpTokenFactory;
  let lpToken;
  let HonorBadgesFactory;
  let honorBadges;

  beforeEach(async () => {
    // eslint-disable-next-line no-unused-vars
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    // Deploy LpToken contract
    LpTokenFactory = await ethers.getContractFactory('LpToken');
    lpToken = await LpTokenFactory.deploy(addr1.address, 100000);

    // fund addr2 with LP tokens
    await lpToken.connect(addr1).transfer(addr2.address, 5000);

    // Deploy honorBadges Contract
    HonorBadgesFactory = await ethers.getContractFactory('HonorBadges');
    honorBadges = await HonorBadgesFactory.deploy(lpToken.address);
  });

  describe('Test stake() method', () => {
      it("Stake event emitted", async () => {
          const amount = 100;
          await lpToken.connect(addr1).approve(honorBadges.address, amount); // user approves transfer amount for stake

          await expect(
              honorBadges.connect(addr1).stake(amount) // stake amount, expect Stake event
          )
            .to.emit(honorBadges, 'Stake')
            .withArgs(addr1.address, amount);
    
          // Check that the contract's user balance of LP staked has the correct amount 
          const lpTokenBalance = await honorBadges.connect(addr1).getStakeBalance(addr1.address);
          expect(lpTokenBalance).to.equal(amount);
      });

      it("Stake 100 LP tokens from a single user", async () => {
          const amount = 100;
          await lpToken.connect(addr1).approve(honorBadges.address, amount); // user approves transfer amount for stake

          await honorBadges.connect(addr1).stake(amount); // stake amount
    
          // Check that the contract's user balance of LP staked has the correct amount 
          const lpTokenBalance = await honorBadges.getStakeBalance(addr1.address);
          expect(lpTokenBalance).to.equal(amount);
      });
  })

  describe('Test withdraw() method', () => {
      beforeEach(async () => {
        const deposit_amount = 100;
        await lpToken.connect(addr1).approve(honorBadges.address, deposit_amount); // user approves transfer amount for stake
        await honorBadges.connect(addr1).stake(deposit_amount);  // add LP tokens that can be withdrawn
      });

      it("Withdraw event emitted", async () => {
        const withdraw_amount = 100;
        await expect(
          honorBadges.connect(addr1).withdraw(withdraw_amount) // withdraw LP tokens and expect a Withdraw event 
      )
        .to.emit(honorBadges, 'Withdraw')
        .withArgs(addr1.address, withdraw_amount);

        const lpTokenBalance = await honorBadges.connect(addr1).getStakeBalance(addr1.address);
        expect(lpTokenBalance).to.equal(0);
      });

      it("Withdraw 100 LP tokens for a single user", async () => {
        const withdraw_amount = 100;
        await honorBadges.connect(addr1).withdraw(withdraw_amount); // withdraw amount

        // Check that the contract's user balance of LP staked has the correct amount 
        const lpTokenBalance = await honorBadges.getStakeBalance(addr1.address);
        expect(lpTokenBalance).to.equal(0);
      });
  })

  describe('Test claim() method', () => {
      it("Claim event emitted", async () => {
        const deposit_amount = 1;
        await lpToken.connect(addr1).approve(honorBadges.address, deposit_amount); // user approves transfer amount for stake
        await honorBadges.connect(addr1).stake(deposit_amount);  // stake LP tokens to begin badge earning

        await increaseWorldTimeInSeconds(60, true); // progress time by one day

        await expect(
          honorBadges.connect(addr1).claim() // stake amount, expect Stake event
      )
        .to.emit(honorBadges, 'Claim')
        .withArgs(addr1.address, 0, false);
      });

      it("Badges cannot be claimed if not earned", async () => {
        // set deposit amount and time to be too low to earn any badges
        
        const deposit_amount = 1;
        await lpToken.connect(addr1).approve(honorBadges.address, deposit_amount); // user approves transfer amount for stake
        await honorBadges.connect(addr1).stake(deposit_amount);  // stake LP tokens to begin badge earning

        await increaseWorldTimeInSeconds(60, true); // progress time by one day

        await honorBadges.connect(addr1).claim();

        // double-check that no badges were earned
        const num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 1);
        expect(num_badge1).to.equal(0);
        const num_badge2 = await honorBadges.connect(addr1).balanceOf(addr1.address, 2);
        expect(num_badge2).to.equal(0);
        const num_badge3 = await honorBadges.connect(addr1).balanceOf(addr1.address, 3);
        expect(num_badge3).to.equal(0);
      });

      it("Badges can be claimed if earned", async () => {
        const deposit_amount = 100;
        let num_badge1, num_badge2, num_badge3 = 0;

        await lpToken.connect(addr1).approve(honorBadges.address, deposit_amount); // user approves transfer amount for stake
        await honorBadges.connect(addr1).stake(deposit_amount);  // stake LP tokens to begin badge earning

        await increaseWorldTimeInSeconds(2 * 60, true); // progress time by two days
        await honorBadges.connect(addr1).claim();
        num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 1); // check for level 1 badge
        expect(num_badge1).to.equal(1);

        await increaseWorldTimeInSeconds(4 * 60, true); // progress time by 4 days
        await honorBadges.connect(addr1).claim();
        num_badge2 = await honorBadges.connect(addr1).balanceOf(addr1.address, 2); // check for lvl 2 badge 
        expect(num_badge2).to.equal(1);

        await increaseWorldTimeInSeconds(6 * 60, true); // progress time by 6 days
        await honorBadges.connect(addr1).claim();
        num_badge3 = await honorBadges.connect(addr1).balanceOf(addr1.address, 3); // check for lvl 3 badge
        expect(num_badge3).to.equal(1);
      });

      it("Badges can only be claimed once", async () => {
        const deposit_amount = 100;
        let num_badge1, num_badge2, num_badge3 = 0;

        await lpToken.connect(addr1).approve(honorBadges.address, deposit_amount); // user approves transfer amount for stake
        await honorBadges.connect(addr1).stake(deposit_amount);  // stake LP tokens to begin badge earning

        await increaseWorldTimeInSeconds(2 * 60, true); // progress time by two days
        await honorBadges.connect(addr1).claim(); // claim a first time
        num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 1); // check for level 1 badge
        expect(num_badge1).to.equal(1);
        await honorBadges.connect(addr1).claim(); // attempt to claim a second time
        num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 1); // check for level 1 badge
        expect(num_badge1).to.equal(1); // check that a lvl 1 badge has not been claimed a second time


        await increaseWorldTimeInSeconds(4 * 60, true); // progress time by 4 days
        await honorBadges.connect(addr1).claim();
        num_badge2 = await honorBadges.connect(addr1).balanceOf(addr1.address, 2); // check for lvl 2 badge 
        expect(num_badge2).to.equal(1);
        await honorBadges.connect(addr1).claim(); // attempt to claim a second time
        num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 2); // check for level 2 badge
        expect(num_badge2).to.equal(1); // check that a lvl 2 badge has not been claimed a second time

        await increaseWorldTimeInSeconds(6 * 60, true); // progress time by 6 days
        await honorBadges.connect(addr1).claim();
        num_badge3 = await honorBadges.connect(addr1).balanceOf(addr1.address, 3); // check for lvl 3 badge
        expect(num_badge3).to.equal(1);
        await honorBadges.connect(addr1).claim(); // attempt to claim a second time
        num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 3); // check for level 3 badge
        expect(num_badge3).to.equal(1); // check that a lvl 3 badge has not been claimed a second time
      });

      it("When a new badge is claimed, all badges from lower levels are burnt", async () => {
        const deposit_amount = 100;
        let num_badge1, num_badge2, num_badge3 = 0;

        await lpToken.connect(addr1).approve(honorBadges.address, deposit_amount); // user approves transfer amount for stake
        await honorBadges.connect(addr1).stake(deposit_amount);  // stake LP tokens to begin badge earning

        await increaseWorldTimeInSeconds(2 * 60, true); // progress time by two days
        await honorBadges.connect(addr1).claim();
        num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 1); // check for level 1 badge
        expect(num_badge1).to.equal(1);

        await increaseWorldTimeInSeconds(4 * 60, true); // progress time by 4 days
        await honorBadges.connect(addr1).claim();
        num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 1); // check for lvl 1 badge 
        num_badge2 = await honorBadges.connect(addr1).balanceOf(addr1.address, 2); // check for lvl 2 badge 
        expect(num_badge1).to.equal(0);
        expect(num_badge2).to.equal(1);

        await increaseWorldTimeInSeconds(6 * 60, true); // progress time by 6 days
        await honorBadges.connect(addr1).claim();
        num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 1); // check for lvl 1 badge 
        num_badge2 = await honorBadges.connect(addr1).balanceOf(addr1.address, 2); // check for lvl 2 badge 
        num_badge3 = await honorBadges.connect(addr1).balanceOf(addr1.address, 3); // check for lvl 3 badge
        expect(num_badge1).to.equal(0);
        expect(num_badge2).to.equal(0);
        expect(num_badge3).to.equal(1);
      });

      it("Badges are earned more quickly if more LP tokens are staked", async () => {
        // addr1 deposits a small amount for 2 days, doesnt get a lvl 1 badge 
        let deposit_amount = 1;
        let num_badge1 = 0

        await lpToken.connect(addr1).approve(honorBadges.address, deposit_amount); // user approves transfer amount for stake
        await honorBadges.connect(addr1).stake(deposit_amount);  // stake LP tokens to begin badge earning

        await increaseWorldTimeInSeconds(2 * 60, true); // progress time by two days
        await honorBadges.connect(addr1).claim();
        num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 1); // check for level 1 badge
        expect(num_badge1).to.equal(0);

        // addr2 deposits a larger amount for 2 days, does get a lvl 1 badge 
        deposit_amount = 100;
        num_badge1 = 0;

        await lpToken.connect(addr2).approve(honorBadges.address, deposit_amount); // user approves transfer amount for stake
        await honorBadges.connect(addr2).stake(deposit_amount);  // stake LP tokens to begin badge earning

        await increaseWorldTimeInSeconds(2 * 60, true); // progress time by two days
        await honorBadges.connect(addr2).claim();
        num_badge1 = await honorBadges.connect(addr2).balanceOf(addr2.address, 1); // check for level 1 badge
        expect(num_badge1).to.equal(1);
      });

      it("Correct badge claimable at correct time, if one amount of LP tokens staked, onced", async () => {
        const deposit_amount = 100;
        let num_badge1, num_badge2, num_badge3 = 0;

        await lpToken.connect(addr1).approve(honorBadges.address, deposit_amount); // user approves transfer amount for stake
        await honorBadges.connect(addr1).stake(deposit_amount);  // stake LP tokens to begin badge earning

        await increaseWorldTimeInSeconds(2 * 60, true); // progress time by two days
        await honorBadges.connect(addr1).claim();
        num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 1); // check for level 1 badge
        num_badge2 = await honorBadges.connect(addr1).balanceOf(addr1.address, 2); // check for level 2 badge
        num_badge3 = await honorBadges.connect(addr1).balanceOf(addr1.address, 3); // check for level 3 badge
        expect(num_badge1).to.equal(1);
        expect(num_badge2).to.equal(0);
        expect(num_badge3).to.equal(0);

        await increaseWorldTimeInSeconds(4 * 60, true); // progress time by 4 days
        await honorBadges.connect(addr1).claim();
        num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 1); // check for level 1 badge
        num_badge2 = await honorBadges.connect(addr1).balanceOf(addr1.address, 2); // check for level 2 badge
        num_badge3 = await honorBadges.connect(addr1).balanceOf(addr1.address, 3); // check for level 3 badge
        expect(num_badge1).to.equal(0);
        expect(num_badge2).to.equal(1);
        expect(num_badge3).to.equal(0);

        await increaseWorldTimeInSeconds(6 * 60, true); // progress time by 6 days
        await honorBadges.connect(addr1).claim();
        num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 1); // check for level 1 badge
        num_badge2 = await honorBadges.connect(addr1).balanceOf(addr1.address, 2); // check for level 2 badge
        num_badge3 = await honorBadges.connect(addr1).balanceOf(addr1.address, 3); // check for level 3 badge
        expect(num_badge1).to.equal(0);
        expect(num_badge2).to.equal(0);
        expect(num_badge3).to.equal(1);
      });

      it("Correct badge claimable at correct time, if multiple amounts of LP tokens staked, at same time", async () => {
        let num_badge1, num_badge2, num_badge3 = 0;

        // test two seperate stakes for the same stake duration --> (50 + 50) * 2 days --> badgeProgress of 200 --> lvl 1 badge
        // stake the first 50 LP tokens
        let deposit_amount = 50; 
        await lpToken.connect(addr1).approve(honorBadges.address, deposit_amount); // user approves transfer amount for stake
        await honorBadges.connect(addr1).stake(deposit_amount);  // stake LP tokens to begin badge earning
        // stake the second 50 LP tokens
        deposit_amount = 50;
        await lpToken.connect(addr1).approve(honorBadges.address, deposit_amount); // user approves transfer amount for stake
        await honorBadges.connect(addr1).stake(deposit_amount);  // stake LP tokens to begin badge earning

        await increaseWorldTimeInSeconds(2 * 60, true); // progress time by two days
        await honorBadges.connect(addr1).claim();
        num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 1); // check for level 1 badge
        num_badge2 = await honorBadges.connect(addr1).balanceOf(addr1.address, 2); // check for level 2 badge
        num_badge3 = await honorBadges.connect(addr1).balanceOf(addr1.address, 3); // check for level 3 badge
        expect(num_badge1).to.equal(1);
        expect(num_badge2).to.equal(0);
        expect(num_badge3).to.equal(0);
      });

      it("Correct badge claimable at correct time, if multiple amounts of LP tokens staked, at different times", async () => {
        let num_badge1, num_badge2, num_badge3 = 0;

        // test two seperate stakes for two different durations --> (25 * 8 days) + (100 * 4 days) --> badgeProgress of 600 --> lvl 2 badge
        // stake 25 LP tokens first, for 4 days ahead of the second stake
        let deposit_amount = 25; 
        await lpToken.connect(addr2).approve(honorBadges.address, deposit_amount); // user approves transfer amount for stake
        await honorBadges.connect(addr2).stake(deposit_amount);  // stake LP tokens to begin badge earning
        await increaseWorldTimeInSeconds(4 * 60, true); // progress time by 4 days

        // stake 100 LP tokens next, for 4 more days
        deposit_amount = 100;
        await lpToken.connect(addr2).approve(honorBadges.address, deposit_amount); // user approves transfer amount for stake
        await honorBadges.connect(addr2).stake(deposit_amount);  // stake LP tokens to begin badge earning
        await increaseWorldTimeInSeconds(4 * 60, true); // progress time by 4 days

        await honorBadges.connect(addr2).claim();
        num_badge1 = await honorBadges.connect(addr2).balanceOf(addr2.address, 1); // check for level 1 badge
        num_badge2 = await honorBadges.connect(addr2).balanceOf(addr2.address, 2); // check for level 2 badge
        num_badge3 = await honorBadges.connect(addr2).balanceOf(addr2.address, 3); // check for level 3 badge
        expect(num_badge1).to.equal(0);
        expect(num_badge2).to.equal(1);
        expect(num_badge3).to.equal(0);
      });

      it("Progress towards next badge is still earned if have aleady earnd a badge and not claimed it", async () => {
        const deposit_amount = 100;
        let num_badge1, num_badge2, num_badge3 = 0;

        await lpToken.connect(addr1).approve(honorBadges.address, deposit_amount); // user approves transfer amount for stake
        await honorBadges.connect(addr1).stake(deposit_amount);  // stake LP tokens to begin badge earning

        await increaseWorldTimeInSeconds(12 * 60, true); // progress time by 12 days
        await honorBadges.connect(addr1).claim();
        num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 1); // check for level 1 badge
        num_badge2 = await honorBadges.connect(addr1).balanceOf(addr1.address, 2); // check for level 2 badge
        num_badge3 = await honorBadges.connect(addr1).balanceOf(addr1.address, 3); // check for level 3 badge
        expect(num_badge1).to.equal(0);
        expect(num_badge2).to.equal(0);
        expect(num_badge3).to.equal(1);
      });
  })

  // REVIEW -- change modifier to disable transfers all together 
  describe('Test safeTransferFrom() method', () => {
      it("A badge cannot be transfered to another account", async () => {
        
        // get a lvl 1 badge to addr1
        const deposit_amount = 100;
        let num_badge1 = 0;

        await lpToken.connect(addr1).approve(honorBadges.address, deposit_amount); // user approves transfer amount for stake
        await honorBadges.connect(addr1).stake(deposit_amount);  // stake LP tokens to begin badge earning

        await increaseWorldTimeInSeconds(2 * 60, true); // progress time by two days
        await honorBadges.connect(addr1).claim();
        num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 1); // check for level 1 badge
        expect(num_badge1).to.equal(1);

        // expect revert on attempt to transfer lvl 1 badge from addr1 to addr2
        await expect(honorBadges.connect(addr1).safeTransferFrom(addr1.address, addr2.address, 1, 1, 0x00)).to.be.revertedWith("Transfers have been disabled for HonorBadges");
      });
  })

  describe('Test safeBatchTransferFrom() method', () => {
    it("A badge cannot be transfered to another account", async () => {
      it("A badge cannot be transfered to another account", async () => {
        
        // get a lvl 1 badge to addr1
        const deposit_amount = 100;
        let num_badge1 = 0;

        await lpToken.connect(addr1).approve(honorBadges.address, deposit_amount); // user approves transfer amount for stake
        await honorBadges.connect(addr1).stake(deposit_amount);  // stake LP tokens to begin badge earning

        await increaseWorldTimeInSeconds(2 * 60, true); // progress time by two days
        await honorBadges.connect(addr1).claim();
        num_badge1 = await honorBadges.connect(addr1).balanceOf(addr1.address, 1); // check for level 1 badge
        expect(num_badge1).to.equal(1);

        // expect revert on attempt to transfer lvl 1 badge from addr1 to addr2
        await expect(honorBadges.connect(addr1).safeBatchTransferFrom(addr1.address, addr2.address, [1], [1], 0x00)).to.be.revertedWith("Transfers have been disabled for HonorBadges");
      });
    });
  })

});