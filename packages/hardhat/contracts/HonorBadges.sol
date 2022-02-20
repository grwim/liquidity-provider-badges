pragma solidity >=0.8.0 <0.9.0;
//SPDX-License-Identifier: MIT

/// @title Non-transferable Badges for Liquidity Providers
/// @author Konrad M. Rauscher

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "./LpToken.sol";

// uint constant MINUTE_IN_SECONDS = 60;
// uint constant HOUR_IN_SECONDS = 60 * MINUTE_IN_SECONDS;
// uint constant DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;
uint constant DAY_IN_SECONDS = 60; //How many seconds in a day. 60 for testing, 86400 for Production

uint256 constant NO_BADGE = 0;
uint256 constant LEVEL_1_BADGE = 1;
uint256 constant LEVEL_2_BADGE = 2;
uint256 constant LEVEL_3_BADGE = 3;

uint constant LVL_1_BADGE_THRESHOLD = 100;
uint constant LVL_2_BADGE_THRESHOLD = 500;
uint constant LVL_3_BADGE_THRESHOLD = 1000;

contract HonorBadges is ERC1155 {

  using SafeMath for uint;

  LpToken public lpToken;

  mapping(address => uint256[]) public lpBalances; // Balances of lp tokens staked for an address
  mapping(address => uint[]) public lpBalanceTimestamps; // Timestamps of changes in lp balance for an address

  // Contract's Events
  event Stake(address indexed sender, uint256 amount);
  event Withdraw(address indexed sender, uint256 amount);
  event Claim(address indexed sender, uint badge_type, bool badge_earned);

  // Contract's Modifiers
  modifier disableTransfers () {  // used to disable the transfer methods of the parent ERC1155
    revert("Transfers have been disabled for HonorBadges");
    _;
  }

  /// @notice constuctor for HonorBadge
  /// @param lpTokenAddress - address of lpToken contract
  /// @dev token metadata specified and hosted as per eip-1155 https://eips.ethereum.org/EIPS/eip-1155#metadata
  constructor(address lpTokenAddress) public ERC1155("http://acro.ai/liquidity-provider-badges/api/token/{id}.json") {
    lpToken = LpToken(lpTokenAddress);
  }

  /// @notice override of the safeTransferFrom function, so that transfer of badges is disabled
  /// @param from - origination address
  /// @param to  - destination address
  /// @param amount - mount of token to transfer
  /// @param id - id of the token
  function safeTransferFrom (
      address from,
      address to,
      uint256 id,
      uint256 amount,
      bytes memory data
  ) public override(ERC1155) disableTransfers() {
      require(
          from == _msgSender() || isApprovedForAll(from, _msgSender()),
          "ERC1155: caller is not owner nor approved"
      );
      _safeTransferFrom(from, to, id, amount, data);
  }

  /// @notice override of the safeBatchTransferFrom function, so that transfer of badges is disabled
  /// @param from - origination address
  /// @param to  - destination address
  /// @param ids - ids of the token
  /// @param amounts - amounts of token to transfer
  /// @param data - ...
  function safeBatchTransferFrom (
      address from,
      address to,
      uint256[] memory ids,
      uint256[] memory amounts,
      bytes memory data
  ) public override(ERC1155) disableTransfers() {
      require(
          from == _msgSender() || isApprovedForAll(from, _msgSender()),
          "ERC1155: transfer caller is not owner nor approved"
      );
      _safeBatchTransferFrom(from, to, ids, amounts, data);
  }

  /// @notice Returns the current amount of LP tokens that an address has staked
  /// @param account - address of the account, for which the current LP token stake balance is wished to be known
  function getStakeBalance(address account) public view returns(uint256 _amount) {
        return lpBalances[account][lpBalances[account].length - 1]; // return the most recent balance value for the address
  }

  /// @notice A user can stake a specified amount of LP tokens from balance of LP tokens the user has already staked on the contract
  /// @param amount - mount of LP token to stake
  function stake ( 
    uint256 amount
  ) public {

    // verify msg.sender has enough lp tokens to stake the specified amount 
    require(lpToken.balanceOf(msg.sender) >= amount, "Not enough LP tokens owned to stake that amount");

    uint256 curr_balance = 0; 
    if (lpBalances[msg.sender].length >= 1) {
      curr_balance = getStakeBalance(msg.sender); // get most recent balance value for the address
    }

    // update state for balances before making external call 
    lpBalances[msg.sender].push(curr_balance + amount); // update balance & balance timestamp for the msg.sender
    lpBalanceTimestamps[msg.sender].push(block.timestamp);

    // transfer lp tokens
    lpToken.transferFrom(msg.sender, address(this), amount);

    emit Stake(msg.sender, amount);
  }

  /// @notice A user can withdraw a specified amount of LP tokens from balance of LP tokens the user has already staked on the contract
  /// @param amount - amount of LP tokens requested to be withdrawn
  function withdraw(uint256 amount) public {
    require(lpBalances[msg.sender].length > 0, "No lp tokens have been staked by msg.sender"); // check that lp tokens have already been staked by the msg.sender

    uint256 userBalance = getStakeBalance(msg.sender); // get most recent balance value for the address

    require(userBalance >= amount, "Not enough LP tokens staked to withdraw that amount");    // verify msg.sender has enough lp tokens staked to withdraw the requested amount

    // update state for balances before making external call 
    lpBalances[msg.sender].push(userBalance - amount); // add new balance value, after withdraw 
    lpBalanceTimestamps[msg.sender].push(block.timestamp); // add new timestamp for new balance 

    lpToken.transfer(msg.sender, amount);  // transfer requested amount to the msg.sender

    emit Withdraw(msg.sender, amount);
  }

  /// @notice Calculates & returns the current badge progress of the specified address
  /// @param account - address of the account, for which the badge progress is wished to be known
  /// @dev used by claim()
  /// @dev REVIEW further gas optimizations likely possible here
  function getBadgeProgress(address account) public view returns(uint256 badgeProgress) {
    
    uint256 badgeProgress = 0;
    uint numStakeBalances = lpBalances[msg.sender].length;

    if (numStakeBalances == 1) { // check if only one balance value thus far
      uint daysSinceStake = SafeMath.div( (block.timestamp - lpBalanceTimestamps[account][0]), DAY_IN_SECONDS ); // if only one balance, then time period is until the current moment
      badgeProgress = lpBalances[account][0] * daysSinceStake;
    } else if (numStakeBalances > 1) {
      for (uint i = 0; i <  numStakeBalances; i++) { // otherwise, if more than once balance then need to calculate badge progress contributions for each balance value window 
        uint daysSinceStake = 0;
        if (i == (numStakeBalances - 1)) { 
          daysSinceStake = SafeMath.div( (block.timestamp - lpBalanceTimestamps[account][i]), DAY_IN_SECONDS );  // if the last balance, then time period is up until the current moment
          badgeProgress += lpBalances[account][i] * daysSinceStake;
        } else {
          daysSinceStake = SafeMath.div( (lpBalanceTimestamps[account][i + 1] - lpBalanceTimestamps[account][i]), DAY_IN_SECONDS ); // otherwise, calculate the badge progress between two balance timestamps
          badgeProgress += lpBalances[account][i] * daysSinceStake;
        }
      }
    }
    return badgeProgress;
  }

  /// @notice allows a user to claim a badge, if eligable. every time a stake claims their badge from the next level they lose all badges from lower levels. a badge can only be claimed once.
  function claim() public {

    require( lpBalances[msg.sender].length > 0, "No stake has been made"); // require that a stake has already been made, before claim can be called

    uint256 badgeProgress = getBadgeProgress(msg.sender); 

    // check badge progress against badge requirements 
    if ((badgeProgress >= LVL_3_BADGE_THRESHOLD) && (this.balanceOf(msg.sender, LEVEL_3_BADGE ) == 0)) // lvl 3 badge threshold has been met, and doesnt have a lvl 3 badge
    {
      if ( this.balanceOf( msg.sender, LEVEL_2_BADGE ) == 1 ) { // check for previous level 2 badge 
        _burn(msg.sender, LEVEL_2_BADGE, 1); // burn 1 lvl 2 badge

      } else if ( this.balanceOf( msg.sender, LEVEL_1_BADGE ) == 1 ) { // check for previous level 1 badge 
        _burn(msg.sender, LEVEL_1_BADGE, 1); // burn 1 lvl 1 badge
      }
      _mint(msg.sender, LEVEL_3_BADGE, 1, ""); // mint one new lvl 3 badge to staker
      emit Claim(msg.sender, LEVEL_3_BADGE, true);
    } else if ( (badgeProgress >= LVL_2_BADGE_THRESHOLD) && (this.balanceOf(msg.sender, LEVEL_2_BADGE ) == 0) ) // lvl two badge threshold has been met, and doesnt have a lvl 2 badge
    {
      if ( this.balanceOf( msg.sender, LEVEL_1_BADGE ) == 1 ) { // check for previous lvl 1 badge 
        _burn(msg.sender, LEVEL_1_BADGE, 1); // burn 1 lvl 1 badge
      }
      _mint(msg.sender, LEVEL_2_BADGE, 1, ""); // mint one new lvl 2 badge to staker
      emit Claim(msg.sender, LEVEL_2_BADGE, true);
    } else if ( (badgeProgress >= LVL_1_BADGE_THRESHOLD) && (this.balanceOf(msg.sender, LEVEL_1_BADGE ) == 0) ) // lvl 1 badge threshold has been met, and doesnt have a lvl 1 badge
    {      
      _mint(msg.sender, LEVEL_1_BADGE, 1, ""); // mint one new lvl 1 badge to staker
      emit Claim(msg.sender, LEVEL_1_BADGE, true);
    } else {
      emit Claim(msg.sender, NO_BADGE, false);
    }
  }
}
