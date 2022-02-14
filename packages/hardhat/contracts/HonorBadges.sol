pragma solidity >=0.8.0 <0.9.0;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";
// import "@openzeppelin/contracts/access/Ownable.sol"; 
// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "@openzeppelin/contracts/access/Ownable.sol";

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "./LpToken.sol";
// LP Badge 

// REVIEW -- ? checks that transfers of LP tokens have ben sent sucsefully? 

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

  mapping(address => uint256[]) public lp_balances; // Balances of lp tokens staked for an address
  mapping(address => uint[]) public lp_balance_timestamps; // Timestamps of changes in lp balance for an address
  // mapping(address => uint) public lp_balance_count; // Count of number of changes to lp balance 

  // Contract's Events
  event Stake(address indexed sender, uint256 amount);
  event Withdraw(address indexed sender, uint256 amount);
  event Claim(address indexed sender, uint badge_type, bool badge_earned);


  // Contract's Modifiers
  modifier disableTransfers () {
    revert("Transfers have been disabled for HonorBadges");
    _;
  }

  // REVIEW meta data used for instantiation
  constructor(address lpTokenAddress) public ERC1155("https://game.example/api/item/{id}.json") {
    lpToken = LpToken(lpTokenAddress);
  }

  /// @notice override of the transfer function, so that badges can only be transfered to and from this contract 
  /// @param from - 
  /// @param to  - 
  /// @param amount - 
  /// @param id - 
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

  /**
  * @dev See {IERC1155-safeBatchTransferFrom}.
  override the batcj transfer function, so that badges can only be transfered by this contract
  */
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

  // keep track of how much staked, for what amount of time
  // need to determine rate that the badges are earned  
  function stake ( 
    uint256 _amount
  ) public {

    // verify msg.sender has enough lp tokens to stake the specified amount 
    require(lpToken.balanceOf(msg.sender) >= _amount, "Not enough LP tokens owned to stake that amount");

    uint256 curr_balance = 0; 
    if (lp_balances[msg.sender].length >= 1) {
      curr_balance = lp_balances[msg.sender][lp_balances[msg.sender].length - 1]; // get most recent balance value for the address
    }

    // update state for balances before making external call 
    lp_balances[msg.sender].push(curr_balance + _amount); // update balance & balance timestamp for the msg.sender
    lp_balance_timestamps[msg.sender].push(block.timestamp);

    // transfer lp tokens
    lpToken.transferFrom(msg.sender, address(this), _amount);

    emit Stake(msg.sender, _amount);
  }

// NOTICE to prevent re-entrance we should always modify the state of the contract before any external contract call 
  function withdraw(uint256 _amount) public {
    require(lp_balances[msg.sender].length > 0, "No lp tokens have been staked by msg.sender"); // check that lp tokens have already been staked by the msg.sender

    uint256 userBalance = getStakeBalance(msg.sender); // get most recent balance value for the address

    require(userBalance >= _amount, "Not enough LP tokens staked to withdraw that amount");    // verify msg.sender has enough lp tokens in the smart contract

    // update state for balances before making external call 
    lp_balances[msg.sender].push(userBalance - _amount); // add new balance value, after withdraw 
    lp_balance_timestamps[msg.sender].push(block.timestamp); // add new timestamp for new balance 

    lpToken.transfer(msg.sender, _amount);  // transfer requested amount to the msg.sender

    emit Withdraw(msg.sender, _amount);
  }

  // returns current state balance
  function getStakeBalance(address _account) public view returns(uint256 _amount) {
        return lp_balances[_account][lp_balances[_account].length - 1]; // return the most recent balance value for the address
  }

  function badgeProgress(address account) public view returns(uint256 badge_progress) {
    
    uint256 badge_progress = 0;

    if (lp_balances[msg.sender].length == 1) { // check if only one balance value thus far
      uint days_since_stake = SafeMath.div( (block.timestamp - lp_balance_timestamps[account][0]), DAY_IN_SECONDS ); // if only one balance, then time period is until the current moment
      badge_progress = lp_balances[account][0] * days_since_stake;
    } else if (lp_balances[msg.sender].length > 1) {
      for (uint i = 0; i <  lp_balances[msg.sender].length; i++) { // if more than once balance then need to calculate badge progress contributions for each balance value window 
        uint days_since_stake = 0;
        if (i == (lp_balances[msg.sender].length - 1)) { 
          days_since_stake = SafeMath.div( (block.timestamp - lp_balance_timestamps[account][i]), DAY_IN_SECONDS );  // if the last balance, then time period is up until the current moment
          badge_progress += lp_balances[account][i] * days_since_stake;
        } else {
          days_since_stake = SafeMath.div( (lp_balance_timestamps[account][i + 1] - lp_balance_timestamps[account][i]), DAY_IN_SECONDS ); // otherwise, calculate the badge progress between two balance timestamps
          badge_progress += lp_balances[account][i] * days_since_stake;
        }
      }
    }
    console.log("badge_progress", badge_progress);
    return badge_progress;
  }

  /// @notice allows a user to claim a badge, if eligable. every time a stake claims their badge from the next level they lose all badges from lower levels.
  function claim() public {

    // REVIEW require( lp_balance[msg.sender] > 0, "No stake has been made");

    uint256 badge_progress = badgeProgress(msg.sender); 

    // check badge progress against badge requirements 
    if ((badge_progress >= LVL_3_BADGE_THRESHOLD) && (this.balanceOf(msg.sender, LEVEL_3_BADGE ) == 0)) // lvl 3 badge threshold has been met, and doesnt have a lvl 3 badge
    {
      if ( this.balanceOf( msg.sender, LEVEL_2_BADGE ) == 1 ) { // check for previous level 2 badge 
        _burn(msg.sender, LEVEL_2_BADGE, 1); // burn 1 lvl 2 badge

      } else if ( this.balanceOf( msg.sender, LEVEL_1_BADGE ) == 1 ) { // check for previous level 1 badge 
        _burn(msg.sender, LEVEL_1_BADGE, 1); // burn 1 lvl 1 badge
      }
      _mint(msg.sender, LEVEL_3_BADGE, 1, ""); // mint one new lvl 3 badge to staker
      emit Claim(msg.sender, LEVEL_3_BADGE, true);
    } else if ( (badge_progress >= LVL_2_BADGE_THRESHOLD) && (this.balanceOf(msg.sender, LEVEL_2_BADGE ) == 0) ) // lvl two badge threshold has been met, and doesnt have a lvl 2 badge
    {
      if ( this.balanceOf( msg.sender, LEVEL_1_BADGE ) == 1 ) { // check for previous lvl 1 badge 
        _burn(msg.sender, LEVEL_1_BADGE, 1); // burn 1 lvl 1 badge
      }
      _mint(msg.sender, LEVEL_2_BADGE, 1, ""); // mint one new lvl 2 badge to staker
      emit Claim(msg.sender, LEVEL_2_BADGE, true);
    } else if ( (badge_progress >= LVL_1_BADGE_THRESHOLD) && (this.balanceOf(msg.sender, LEVEL_1_BADGE ) == 0) ) // lvl 1 badge threshold has been met, and doesnt have a lvl 1 badge
    {      
      _mint(msg.sender, LEVEL_1_BADGE, 1, ""); // mint one new lvl 1 badge to staker
      emit Claim(msg.sender, LEVEL_1_BADGE, true);
    } else {
      console.log("Not eligable for a new badge.");
      emit Claim(msg.sender, NO_BADGE, false);
    }
  }

  // to support receiving ETH by default
  receive() external payable {}
  fallback() external payable {}
}
