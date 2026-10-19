// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

// Intentionally small behavioral fixtures, not production token implementations.
contract FixtureToken {
    string public name = 'Compatibility Fixture';
    string public symbol = 'LAB';
    uint8 public decimals = 6;
    uint256 public totalSupply = 1_000_000_000_000;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    address public owner;
    uint256 public immutable behavior;
    bool public paused;
    mapping(address => bool) public blacklisted;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    constructor(uint256 mode) {
        owner = msg.sender; behavior = mode; balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }
    modifier onlyOwner() { require(msg.sender == owner, 'owner only'); _; }
    function setPaused(bool value) external onlyOwner { require(behavior == 5, 'no pause'); paused = value; }
    function setBlacklisted(address account, bool value) external onlyOwner {
        require(behavior == 6, 'no blacklist'); blacklisted[account] = value;
    }
    function _returnValue() internal view returns (bool) {
        if (behavior == 1) { assembly { return(0, 0) } }
        if (behavior == 8) { assembly { mstore(0, 0xff) return(31, 1) } }
        return behavior != 2;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        if (behavior == 2) return false;
        _move(msg.sender, to, amount); return _returnValue();
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        if (behavior == 2) return false;
        if (amount == 0) {
            if (behavior == 18) return false;
            if (behavior == 25) revert('revocation rejected');
            if (behavior == 27) _move(msg.sender, spender, 1);
        }
        if (behavior == 4) require(amount == 0 || allowance[msg.sender][spender] == 0, 'reset to zero');
        if (behavior != 20 || amount != 0) allowance[msg.sender][spender] = behavior == 15 ? amount + 1 : amount;
        if (behavior != 14 && (behavior != 19 || amount != 0)) emit Approval(msg.sender, spender, amount);
        if (behavior == 26 && amount == 0) { assembly { mstore(0, 0xff) return(31, 1) } }
        return _returnValue();
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (behavior == 2) return false;
        if (amount > 0 && allowance[from][msg.sender] == 0) {
            if (behavior == 21 || behavior == 22) { _move(from, to, amount); return behavior == 21; }
            if (behavior == 23) return false;
            if (behavior == 24) { assembly { mstore(0, 0xff) return(31, 1) } }
            if (behavior == 28) { emit Transfer(from, to, amount); return false; }
            if (behavior == 29) return true;
            if (behavior == 30) {
                bytes32 topic = keccak256('Transfer(address,address,uint256)');
                assembly { log1(0, 0, topic) }
                return false;
            }
        }
        if (amount == 0) {
            if (behavior == 12) revert('zero delegation rejected');
            if (behavior == 16) return false;
            if (behavior == 17) { assembly { mstore(0, 0xff) return(31, 1) } }
        }
        require(allowance[from][msg.sender] >= amount, 'allowance');
        allowance[from][msg.sender] -= behavior == 13 && amount == 0 ? 1 : amount;
        _move(from, to, amount); return _returnValue();
    }
    function _move(address from, address to, uint256 amount) internal {
        require(!paused, 'paused');
        require(!blacklisted[from] && !blacklisted[to], 'blacklisted');
        require(balanceOf[from] >= amount, 'balance');
        if (behavior == 9) require(amount != 0, 'zero transfer rejected');
        if (behavior == 11 && amount == 0) {
            // Deliberately incorrect: move one unit while claiming a zero transfer.
            balanceOf[from] -= 1; balanceOf[to] += 1;
            emit Transfer(from, to, 0); return;
        }
        uint256 fee = behavior == 3 ? amount / 100 : 0;
        balanceOf[from] -= amount; balanceOf[to] += amount - fee;
        if (behavior != 7 && (behavior != 10 || amount != 0)) emit Transfer(from, to, amount - fee);
        if (fee > 0) { totalSupply -= fee; emit Transfer(from, address(0), fee); }
    }
}
contract StandardToken is FixtureToken { constructor() FixtureToken(0) {} }
contract NoReturnToken is FixtureToken { constructor() FixtureToken(1) {} }
contract FalseReturnToken is FixtureToken { constructor() FixtureToken(2) {} }
contract FeeToken is FixtureToken { constructor() FixtureToken(3) {} }
contract ZeroResetToken is FixtureToken { constructor() FixtureToken(4) {} }
contract PausableToken is FixtureToken { constructor() FixtureToken(5) {} }
contract BlacklistToken is FixtureToken { constructor() FixtureToken(6) {} }

// Additional negative fixtures: ABI decoding failure vs actual RPC revert.
contract InvalidMetadata {
    function name() external pure returns (string memory) { revert('unavailable'); }
    fallback() external { assembly { mstore(0, 0xff) return(31, 1) } }
}

contract MissingEventToken is FixtureToken {
    constructor() FixtureToken(7) {}
}
contract MalformedReturnToken is FixtureToken {
    constructor() FixtureToken(8) {}
}
contract ZeroTransferRevertToken is FixtureToken { constructor() FixtureToken(9) {} }
contract ZeroTransferNoEventToken is FixtureToken { constructor() FixtureToken(10) {} }
contract ZeroTransferMutatingToken is FixtureToken { constructor() FixtureToken(11) {} }
contract ZeroDelegationRevertToken is FixtureToken { constructor() FixtureToken(12) {} }
contract ZeroDelegationConsumesAllowanceToken is FixtureToken { constructor() FixtureToken(13) {} }
contract ApprovalNoEventToken is FixtureToken { constructor() FixtureToken(14) {} }
contract ApprovalWrongAllowanceToken is FixtureToken { constructor() FixtureToken(15) {} }
contract ZeroDelegationFalseToken is FixtureToken { constructor() FixtureToken(16) {} }
contract ZeroDelegationMalformedToken is FixtureToken { constructor() FixtureToken(17) {} }
contract RevokeFalseToken is FixtureToken { constructor() FixtureToken(18) {} }
contract RevokeNoEventToken is FixtureToken { constructor() FixtureToken(19) {} }
contract RevokeResidualAllowanceToken is FixtureToken { constructor() FixtureToken(20) {} }
contract RevokedAllowanceBypassToken is FixtureToken { constructor() FixtureToken(21) {} }
contract RevokedFalseMutatingToken is FixtureToken { constructor() FixtureToken(22) {} }
contract RevokedFalseToken is FixtureToken { constructor() FixtureToken(23) {} }
contract RevokedMalformedToken is FixtureToken { constructor() FixtureToken(24) {} }
contract RevokeRevertToken is FixtureToken { constructor() FixtureToken(25) {} }
contract RevokeMalformedToken is FixtureToken { constructor() FixtureToken(26) {} }
contract RevokeMutatingToken is FixtureToken { constructor() FixtureToken(27) {} }
contract RevokedFalseEventToken is FixtureToken { constructor() FixtureToken(28) {} }
contract RevokedTrueToken is FixtureToken { constructor() FixtureToken(29) {} }
contract RevokedMalformedEventToken is FixtureToken { constructor() FixtureToken(30) {} }

// Proxy probes use only newly deployed local fixtures; these are not production proxies.
contract ProxySlotFixture {
    constructor(address implementation_, address beacon_, address admin_) {
        assembly {
            sstore(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc, implementation_)
            sstore(0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50, beacon_)
            sstore(0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103, admin_)
        }
    }
    fallback() external {
        address target;
        assembly { target := sload(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc) }
        if (target == address(0)) {
            address beacon;
            assembly { beacon := sload(0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50) }
            target = BeaconFixture(beacon).implementation();
        }
        assembly {
            calldatacopy(0, 0, calldatasize())
            let ok := delegatecall(gas(), target, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch ok case 0 { revert(0, returndatasize()) } default { return(0, returndatasize()) }
        }
    }
}
contract BeaconFixture {
    address private immutable target;
    address private immutable alternate;
    constructor(address target_, address alternate_) { target = target_; alternate = alternate_; }
    function implementation() external view returns (address) {
        return msg.sender == address(0) && alternate != address(0) ? alternate : target;
    }
}
// A populated slot alone cannot prove delegation or upgrade capability.
contract SlotSpoofFixture {
    constructor(address target) {
        assembly { sstore(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc, target) }
    }
    fallback() external { revert('not a delegating proxy'); }
}
contract SelfTargetFixture {
    constructor() {
        address self = address(this);
        assembly { sstore(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc, self) }
    }
}

// Independent fixtures for the historical ZeppelinOS slot convention.
// Modern slots can also be populated to exercise ambiguity without node storage overrides.
contract LegacyProxyFixture {
    constructor(address target, address admin, address modernTarget, address beacon) {
        assembly {
            sstore(0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3, target)
            sstore(0x10d6a54a4754c8869d6886b5f5d7fbfa5b4522237ea5c60d11bc4e7a1ff9390b, admin)
            sstore(0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc, modernTarget)
            sstore(0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50, beacon)
        }
    }
    fallback() external {
        assembly {
            let target := sload(0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3)
            calldatacopy(0, 0, calldatasize())
            let ok := delegatecall(gas(), target, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch ok case 0 { revert(0, returndatasize()) } default { return(0, returndatasize()) }
        }
    }
}
contract LegacySlotSpoofFixture {
    constructor(address target) {
        assembly { sstore(0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3, target) }
    }
    fallback() external { revert('not a delegating proxy'); }
}
contract LegacySelfTargetFixture {
    constructor() {
        address self = address(this);
        assembly { sstore(0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3, self) }
    }
}
