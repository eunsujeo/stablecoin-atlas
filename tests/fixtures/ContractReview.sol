// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Synthetic fixture. Not a vendored upstream contract or proof of deployed behavior.
contract BatchFixture {
    struct Call3 { address target; bool allowFailure; bytes callData; }
    struct Call3Value { address target; bool allowFailure; uint256 value; bytes callData; }
    struct Result { bool success; bytes returnData; }
    function aggregate3(Call3[] calldata calls) public payable returns (Result[] memory results) {
        results = new Result[](calls.length);
        for (uint256 i; i < calls.length; i++) {
            (results[i].success, results[i].returnData) = calls[i].target.call(calls[i].callData);
            require(calls[i].allowFailure || results[i].success, "batch failed");
        }
    }
    function aggregate3Value(Call3Value[] calldata calls) public payable returns (Result[] memory results) {
        results = new Result[](calls.length); uint256 total;
        for (uint256 i; i < calls.length; i++) {
            total += calls[i].value;
            (results[i].success, results[i].returnData) = calls[i].target.call{value: calls[i].value}(calls[i].callData);
            require(calls[i].allowFailure || results[i].success, "batch failed");
        }
        require(total == msg.value, "value mismatch");
    }
}
contract ObserveFixture {
    address public lastSender;
    uint256 public lastValue;
    uint256 public counter;
    event Observed(address sender, uint256 value);
    function observe() external payable returns (address, uint256) {
        lastSender = msg.sender; lastValue = msg.value; counter++; emit Observed(msg.sender, msg.value);
        return (msg.sender, msg.value);
    }
    function fail() external payable { revert("fixture failure"); }
}
contract TokenFixture {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    event Transfer(address indexed from, address indexed to, uint256 amount);
    constructor() { balanceOf[msg.sender] = 100; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; return true; }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "allowance");
        allowance[from][msg.sender] -= amount; balanceOf[from] -= amount; balanceOf[to] += amount;
        emit Transfer(from, to, amount); return true;
    }
}
contract WalletFixture {
    uint256 public marker = 777;
    function execute(address code, bytes calldata data) external payable returns (bytes memory) {
        (bool success, bytes memory result) = code.delegatecall(data); require(success, "delegate failed"); return result;
    }
}
contract ContextFixture {
    uint256 public marker;
    event Context(address sender, uint256 value, address context);
    function setMarker(uint256 value) external payable { marker = value; emit Context(msg.sender, msg.value, address(this)); }
}
contract VaultFixture {
    address public owner;
    mapping(address => uint256) public balances;
    modifier onlyOwner() { require(msg.sender == owner, "owner"); _; }
    function sweep(address payable destination, uint256 amount) external onlyOwner { destination.transfer(amount); }
    function forward(address target, bytes calldata data) external onlyOwner returns (bytes memory) {
        (bool ok, bytes memory result) = target.call(data); require(ok); return result;
    }
    function query(address target, bytes calldata data) external view returns (bytes memory) {
        (bool ok, bytes memory result) = target.staticcall(data); require(ok); return result;
    }
    function upgradeTo(address implementation) external onlyOwner { (bool ok,) = implementation.delegatecall(""); require(ok); }
    function deposit() external payable { balances[msg.sender] += msg.value; }
}
