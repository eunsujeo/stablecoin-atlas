// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

interface ReviewHook { function received(address account, uint256 value) external; }
contract ReviewRuleBase {
    address public owner;
    modifier checked() { _checkOwner(); _; }
    modifier afterCheck() { _; require(msg.sender == owner); }
    modifier twice() { _; _; }
    function _checkOwner() internal view virtual { require(msg.sender == owner); }
}
contract ReviewRuleToken is ReviewRuleBase {
    mapping(address => uint256) public balances;
    mapping(address => mapping(address => uint256)) public allowances;
    mapping(address => bool) public blocked;
    uint256 public totalSupply;
    uint256 public feeBps = 10;
    ReviewHook public hook;
    function changeOwner(address next) external checked { owner = next; }
    function guardedMint(address to, uint256 amount) external checked { _mint(to, amount); }
    function openMint(address to, uint256 amount) external { _mint(to, amount); }
    function _mint(address to, uint256 amount) internal { balances[to] += amount; totalSupply += amount; }
    function transfer(address to, uint256 amount) external returns(bool) {
        require(!blocked[msg.sender]);
        if (amount == 0) return false;
        uint256 fee = amount * feeBps / 10000;
        balances[msg.sender] -= amount;
        balances[to] += amount - fee;
        hook.received(to, amount);
        return true;
    }
    function approve(address spender, uint256 amount) external returns(bool) {
        require(allowances[msg.sender][spender] == 0 || amount == 0);
        allowances[msg.sender][spender] = amount;
        return true;
    }
    function aliasWrite(address to) external {
        mapping(address => uint256) storage aliasBalances = balances;
        aliasBalances[to] += 1;
    }
    function changeAfter(address next) external afterCheck { owner = next; }
    function repeated(address next) external twice { owner = next; }
    function bypass(address next, bool allowed) external { require(msg.sender == owner || allowed); owner = next; }
    function cycle() external { _a(); }
    function _a() internal { _b(); }
    function _b() internal { _a(); }
    function rawStore() external { assembly { sstore(0, caller()) } }
}
contract ReviewRuleOverride is ReviewRuleToken {
    function _checkOwner() internal view override { }
    function superCheck() external view { super._checkOwner(); }
}
contract ReviewFakeGuard {
    address public owner;
    function require(bool value) internal pure { value; }
    function update(address next) external { require(msg.sender == owner); owner = next; }
}
contract ReviewImmutable {
    uint256 public immutable cap;
    constructor(uint256 value) { require(value < 100); cap = value; }
}
library ReviewMath {
    function twice(uint256 value) public pure returns (uint256) { return value * 2; }
}
contract ReviewLinked {
    function calculate(uint256 value) external pure returns (uint256) { return ReviewMath.twice(value); }
}
