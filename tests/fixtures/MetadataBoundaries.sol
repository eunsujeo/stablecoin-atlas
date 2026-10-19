// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

// Read-only metadata fixtures. No transfer, approval, mint, or administrator operations.
// uint256 getter deliberately supplies out-of-range words to callers expecting uint8.
contract MetadataBoundaryFixture {
    uint256 public immutable decimals;
    uint256 public immutable totalSupply;
    address private immutable holder;
    string public name;
    string public symbol;
    constructor(uint256 decimals_, uint256 supply_, string memory name_, string memory symbol_) {
        decimals = decimals_; totalSupply = supply_; name = name_; symbol = symbol_; holder = msg.sender;
    }
    function balanceOf(address account) external view returns (uint256) { return account == holder ? totalSupply : 0; }
}
contract RequiredMetadataOnlyFixture {
    uint8 public constant decimals = 18;
    uint256 public constant totalSupply = 42;
    function balanceOf(address) external pure returns (uint256) { return 0; }
}
contract RevertingDecimalsFixture {
    string public constant name = 'Read failure';
    string public constant symbol = 'RF';
    uint256 public constant totalSupply = 42;
    function decimals() external pure returns (uint8) { revert('metadata unavailable'); }
    function balanceOf(address) external pure returns (uint256) { return 0; }
}
contract MalformedNumericMetadataFixture {
    string public constant name = 'Malformed numeric metadata';
    string public constant symbol = 'BAD';
    function decimals() external pure returns (uint8) { assembly { return(0, 1) } }
    function totalSupply() external pure returns (uint256) { assembly { return(0, 1) } }
    function balanceOf(address) external pure returns (uint256) { return 0; }
}
contract Bytes32MetadataFixture {
    bytes32 public constant name = 'Legacy label';
    bytes32 public constant symbol = 'B32';
    uint8 public constant decimals = 6;
    uint256 public constant totalSupply = 42;
    function balanceOf(address) external pure returns (uint256) { return 0; }
}
