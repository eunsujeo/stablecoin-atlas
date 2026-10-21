// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// Independent disposable test probes, deliberately violating one transfer expectation.
// These are not complete TRC-20 implementations and have no administrative entrypoints.
abstract contract TronNegativeTokenBase {
    string public constant name = "Private TVM Fixture";
    string public constant symbol = "TVMF";
    uint8 public constant decimals = 6;
    uint256 public constant totalSupply = 2 ** 128;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    constructor() {
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }
    function move(address to, uint256 value, bool emitTransfer) internal {
        require(to != address(0) && balanceOf[msg.sender] >= value, "balance or recipient");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        if (emitTransfer) emit Transfer(msg.sender, to, value);
    }
}
contract TronFalseReturnToken is TronNegativeTokenBase {
    function transfer(address to, uint256 value) external returns (bool) {
        move(to, value, true);
        return false;
    }
}
contract TronMalformedReturnToken is TronNegativeTokenBase {
    function transfer(address to, uint256 value) external returns (bool) {
        move(to, value, true);
        assembly { mstore(0, 2) return(0, 32) }
    }
}
contract TronMissingEventToken is TronNegativeTokenBase {
    function transfer(address to, uint256 value) external returns (bool) {
        move(to, value, false);
        return true;
    }
}
