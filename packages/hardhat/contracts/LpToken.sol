pragma solidity >=0.8.0 <0.9.0;
//SPDX-License-Identifier: MIT

import "hardhat/console.sol";
// import "@openzeppelin/contracts/access/Ownable.sol"; 
// https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/access/Ownable.sol


import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract LpToken is ERC20 {

  event SetPurpose(address sender, string purpose);

  string public purpose = "for testing of HonorBadges";

  constructor(address mint_destination, uint256 initialSupply) public ERC20("LPtest", "LPT" ) {
    _mint(mint_destination, initialSupply);
  }

  function mint() public {

  }

  function setPurpose(string memory newPurpose) public {
      purpose = newPurpose;
      console.log(msg.sender,"set purpose to",purpose);
      emit SetPurpose(msg.sender, purpose);
  }
}
