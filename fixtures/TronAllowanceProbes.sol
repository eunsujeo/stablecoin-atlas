// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// Disposable private-TVM probes; not an operating stablecoin implementation.
// Modes: 0 normal, 1 false return, 2 bool word 2, 3 missing event,
// 4 unchanged allowance. Only the selected operation is defective.
abstract contract TronAllowanceProbeBase {
    string public constant name = "Private TVM Fixture";
    string public constant symbol = "TVMF";
    uint8 public constant decimals = 6;
    uint256 public constant totalSupply = 2 ** 128;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint8 private selectedOperation;
    uint8 private defect;
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    constructor(uint8 operation, uint8 mode) {
        selectedOperation = operation; defect = mode;
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }
    function approve(address spender, uint256 value) external returns (bool) {
        uint8 mode = selectedOperation == 1 ? defect : 0;
        if (mode != 4) allowance[msg.sender][spender] = value;
        if (mode != 3) emit Approval(msg.sender, spender, value);
        return result(mode);
    }
    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        require(to != address(0) && allowance[from][msg.sender] >= value && balanceOf[from] >= value, "allowance/balance/recipient");
        uint8 mode = selectedOperation == 2 ? defect : 0;
        if (mode != 4) allowance[from][msg.sender] -= value;
        balanceOf[from] -= value; balanceOf[to] += value;
        if (mode != 3) emit Transfer(from, to, value);
        return result(mode);
    }
    function result(uint8 mode) private pure returns (bool) {
        if (mode == 2) { assembly { mstore(0, 2) return(0, 32) } }
        return mode != 1;
    }
}
contract TronAllowanceControl is TronAllowanceProbeBase { constructor() TronAllowanceProbeBase(0, 0) {} }
contract TronApproveFalse is TronAllowanceProbeBase { constructor() TronAllowanceProbeBase(1, 1) {} }
contract TronApproveMalformed is TronAllowanceProbeBase { constructor() TronAllowanceProbeBase(1, 2) {} }
contract TronApproveMissingEvent is TronAllowanceProbeBase { constructor() TronAllowanceProbeBase(1, 3) {} }
contract TronApproveWrongAllowance is TronAllowanceProbeBase { constructor() TronAllowanceProbeBase(1, 4) {} }
contract TronDelegatedFalse is TronAllowanceProbeBase { constructor() TronAllowanceProbeBase(2, 1) {} }
contract TronDelegatedMalformed is TronAllowanceProbeBase { constructor() TronAllowanceProbeBase(2, 2) {} }
contract TronDelegatedMissingEvent is TronAllowanceProbeBase { constructor() TronAllowanceProbeBase(2, 3) {} }
contract TronDelegatedWrongAllowance is TronAllowanceProbeBase { constructor() TronAllowanceProbeBase(2, 4) {} }
