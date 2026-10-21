// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// Independent, disposable private-TVM fixture. Not an operating token implementation.
contract TronStandardToken {
    string public constant name = "Private TVM Fixture";
    string public constant symbol = "TVMF";
    uint8 public constant decimals = 6;
    uint256 public constant totalSupply = 2 ** 128;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    constructor() {
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }
    function transfer(address to, uint256 value) external returns (bool) {
        move(msg.sender, to, value); return true;
    }
    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value; emit Approval(msg.sender, spender, value); return true;
    }
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(allowance[from][msg.sender] >= value, "allowance");
        allowance[from][msg.sender] -= value; move(from, to, value); return true;
    }
    function move(address from, address to, uint256 value) private {
        require(to != address(0) && balanceOf[from] >= value, "balance or recipient");
        balanceOf[from] -= value; balanceOf[to] += value; emit Transfer(from, to, value);
    }
}
