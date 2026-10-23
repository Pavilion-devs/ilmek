// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title FiberLedger
/// @notice Mass-balance ledger for recycled textile fiber. Every processing step consumes
///         its inputs and may not output more recycled mass than the inputs physically allow.
///         Each lot also carries its embedded CO2e, which the contract propagates itself.
/// @dev Units: mass in grams, CO2e in grams, yields in basis points (10000 = 100%).
contract FiberLedger is EIP712 {
    // ------------------------------------------------------------------ types

    enum Stage {
        None,
        Bale, // sorted post-consumer PET bottle bales
        Flake, // washed PET flake
        Chip, // recycled PET chip / pellet
        Yarn, // spun yarn or staple fiber
        Fabric,
        Garment
    }

    enum Role {
        None,
        Recycler,
        Spinner,
        FabricMill,
        GarmentMaker,
        Brand
    }

    struct Lot {
        Stage stage;
        address owner;
        uint64 producedAt; // unix seconds, from the step's documents
        bool revoked;
        uint64 totalG; // mass when the lot was created
        uint64 recycledG; // recycled mass when the lot was created
        uint64 remainingG;
        uint64 recycledRemainingG;
        uint128 embeddedCo2eG; // embedded CO2e when the lot was created
        uint128 embeddedRemainingG;
        bytes32 certHash; // transaction / scope certificate this lot rests on (0 if none)
        bytes32 evidenceRoot; // Merkle root of the off-chain evidence bundle
    }

    struct Passport {
        uint256 lotId;
        address brand;
        uint16 recycledBps; // recycled share of the garment lot
        uint32 co2eGPerKg; // embedded CO2e per kg of product
        bytes32 claimHash; // hash of the approved consumer-facing claim text
        uint64 mintedAt;
    }

    struct Certifier {
        bool active;
        bytes32 pqPubKeyHash; // keccak256 of the certifier's ML-DSA-44 public key (verified off-chain)
    }

    struct TransformRequest {
        uint256[] inputLotIds;
        uint64[] consumeG;
        uint64 virginG; // uncertified virgin material added at this step
        Stage outputStage;
        uint64 outputTotalG;
        uint64 outputRecycledG;
        uint128 processCo2eG; // emissions of this step (energy x grid factor + heat)
        uint64 producedAt;
        bytes32 certHash;
        bytes32 evidenceRoot;
    }

    // ------------------------------------------------------------------ storage

    bytes32 public constant TRANSFORM_TYPEHASH = keccak256(
        "Transform(address owner,uint256[] inputLotIds,uint64[] consumeG,uint64 virginG,uint8 outputStage,"
        "uint64 outputTotalG,uint64 outputRecycledG,uint128 processCo2eG,uint64 producedAt,bytes32 certHash,"
        "bytes32 evidenceRoot)"
    );

    address public admin;
    uint256 public lotCount;

    mapping(address => Certifier) public certifiers;
    mapping(address => Role) public roleOf;
    mapping(address => bytes32) public partyIdOf; // pseudonymous ID; real names stay off-chain
    mapping(Stage => mapping(Stage => uint16)) public maxYieldBps;
    mapping(Stage => uint32) public virginCo2eGPerKg;
    mapping(bytes32 => bool) public certUsed;

    mapping(uint256 => Lot) internal _lots;
    mapping(uint256 => uint256[]) internal _parents;
    mapping(uint256 => Passport) internal _passports;

    // ------------------------------------------------------------------ events

    event CertifierSet(address indexed certifier, bool active, bytes32 pqPubKeyHash);
    event PartyRegistered(address indexed party, Role role, bytes32 partyId);
    event YieldSet(Stage indexed from, Stage indexed to, uint16 maxYieldBps);
    event VirginFactorSet(Stage indexed stage, uint32 co2eGPerKg);
    event InputRegistered(
        uint256 indexed lotId, address indexed owner, address indexed certifier, uint64 totalG, bytes32 certHash
    );
    event Transformed(
        uint256 indexed lotId,
        address indexed owner,
        address indexed certifier,
        Stage stage,
        uint64 totalG,
        uint64 recycledG,
        uint128 embeddedCo2eG
    );
    event Consumed(uint256 indexed lotId, uint256 indexed intoLotId, uint64 grams, uint64 recycledG);
    event Shipped(uint256 indexed fromLotId, uint256 indexed toLotId, address indexed to, uint64 grams, bytes32 certHash);
    event LotRevoked(uint256 indexed lotId, address indexed certifier, bytes32 reasonHash);
    event PassportMinted(uint256 indexed lotId, address indexed brand, uint16 recycledBps, uint32 co2eGPerKg, bytes32 claimHash);

    // ------------------------------------------------------------------ errors

    error NotAdmin();
    error NotCertifier(address who);
    error NotLotOwner(uint256 lotId);
    error WrongRole(address who, Role expected);
    error UnknownParty(address who);
    error UnknownLot(uint256 lotId);
    error LotIsRevoked(uint256 lotId);
    error BadTransition(Stage from, Stage to);
    error StageMismatch(uint256 lotId);
    error LengthMismatch();
    error EmptyInputs();
    error DuplicateInput(uint256 lotId);
    error ZeroAmount();
    error ZeroCertificate();
    error CertificateAlreadyUsed(bytes32 certHash);
    error InsufficientLot(uint256 lotId, uint64 requested, uint64 available);
    error RecycledExceedsInputs(uint64 claimed, uint64 maxAllowed);
    error MassExceedsInputs(uint64 claimed, uint64 maxAllowed);
    error RecycledExceedsTotal();
    error ProducedBeforeInput(uint256 lotId);
    error ProducedInFuture();
    error NotGarment(uint256 lotId);
    error PassportExists(uint256 lotId);

    // ------------------------------------------------------------------ setup

    constructor() EIP712("FiberLedger", "1") {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyCertifier() {
        if (!certifiers[msg.sender].active) revert NotCertifier(msg.sender);
        _;
    }

    function setCertifier(address certifier, bool active, bytes32 pqPubKeyHash) external onlyAdmin {
        certifiers[certifier] = Certifier(active, pqPubKeyHash);
        emit CertifierSet(certifier, active, pqPubKeyHash);
    }

    function registerParty(address party, Role role, bytes32 partyId) external onlyAdmin {
        roleOf[party] = role;
        partyIdOf[party] = partyId;
        emit PartyRegistered(party, role, partyId);
    }

    function setMaxYield(Stage from, Stage to, uint16 bps) external onlyAdmin {
        require(bps <= 10000, "bps>100%");
        maxYieldBps[from][to] = bps;
        emit YieldSet(from, to, bps);
    }

    function setVirginFactor(Stage stage, uint32 co2eGPerKg) external onlyAdmin {
        virginCo2eGPerKg[stage] = co2eGPerKg;
        emit VirginFactorSet(stage, co2eGPerKg);
    }

    // ------------------------------------------------------------------ material flow

    /// @notice A certifier registers certified recycled input (bottle bales) for a recycler.
    function registerInput(
        address owner,
        uint64 totalG,
        uint128 embeddedCo2eG,
        uint64 producedAt,
        bytes32 certHash,
        bytes32 evidenceRoot
    ) external onlyCertifier returns (uint256 lotId) {
        if (roleOf[owner] != Role.Recycler) revert WrongRole(owner, Role.Recycler);
        if (totalG == 0) revert ZeroAmount();
        if (producedAt > block.timestamp) revert ProducedInFuture();
        _useCert(certHash, true);

        lotId = ++lotCount;
        _lots[lotId] = Lot({
            stage: Stage.Bale,
            owner: owner,
            producedAt: producedAt,
            revoked: false,
            totalG: totalG,
            recycledG: totalG,
            remainingG: totalG,
            recycledRemainingG: totalG,
            embeddedCo2eG: embeddedCo2eG,
            embeddedRemainingG: embeddedCo2eG,
            certHash: certHash,
            evidenceRoot: evidenceRoot
        });
        emit InputRegistered(lotId, owner, msg.sender, totalG, certHash);
    }

    /// @notice The lot owner turns input lots into a new lot at the next stage, with a certifier's
    ///         EIP-712 approval. Physical limits are enforced even when the approval is valid.
    function transform(TransformRequest calldata r, bytes calldata certifierSig) external returns (uint256 lotId) {
        uint256 n = r.inputLotIds.length;
        if (n == 0) revert EmptyInputs();
        if (n != r.consumeG.length) revert LengthMismatch();
        if (r.outputTotalG == 0) revert ZeroAmount();
        if (r.outputRecycledG > r.outputTotalG) revert RecycledExceedsTotal();
        if (r.producedAt > block.timestamp) revert ProducedInFuture();

        Role need = _roleFor(r.outputStage);
        if (roleOf[msg.sender] != need) revert WrongRole(msg.sender, need);

        address certifier = _recoverTransformSigner(msg.sender, r, certifierSig);
        if (!certifiers[certifier].active) revert NotCertifier(certifier);

        Stage from = _lots[r.inputLotIds[0]].stage;
        uint16 yieldBps = maxYieldBps[from][r.outputStage];
        if (yieldBps == 0) revert BadTransition(from, r.outputStage);

        _useCert(r.certHash, false);

        lotId = ++lotCount;
        (uint64 totalIn, uint64 recycledIn, uint128 embeddedIn) = _consumeAll(r, from, lotId);

        // Physics: what comes out cannot exceed what went in, after the best realistic yield.
        uint64 maxRecycled = uint64((uint256(recycledIn) * yieldBps) / 10000);
        if (r.outputRecycledG > maxRecycled) revert RecycledExceedsInputs(r.outputRecycledG, maxRecycled);
        uint64 maxTotal = uint64((uint256(totalIn) + r.virginG) * yieldBps / 10000);
        if (r.outputTotalG > maxTotal) revert MassExceedsInputs(r.outputTotalG, maxTotal);

        uint128 embedded =
            embeddedIn + uint128((uint256(r.virginG) * virginCo2eGPerKg[from]) / 1000) + r.processCo2eG;

        _lots[lotId] = Lot({
            stage: r.outputStage,
            owner: msg.sender,
            producedAt: r.producedAt,
            revoked: false,
            totalG: r.outputTotalG,
            recycledG: r.outputRecycledG,
            remainingG: r.outputTotalG,
            recycledRemainingG: r.outputRecycledG,
            embeddedCo2eG: embedded,
            embeddedRemainingG: embedded,
            certHash: r.certHash,
            evidenceRoot: r.evidenceRoot
        });
        emit Transformed(lotId, msg.sender, certifier, r.outputStage, r.outputTotalG, r.outputRecycledG, embedded);
    }

    /// @notice Ship part or all of a lot to another registered party. Each shipment needs its own
    ///         transaction certificate, and a certificate can back only one shipment.
    function ship(uint256 lotId, uint64 grams, address to, bytes32 certHash) external returns (uint256 childId) {
        Lot storage lot = _lots[lotId];
        if (lot.stage == Stage.None) revert UnknownLot(lotId);
        if (lot.owner != msg.sender) revert NotLotOwner(lotId);
        if (roleOf[to] == Role.None) revert UnknownParty(to);
        _useCert(certHash, true);

        childId = ++lotCount;
        (uint64 rec, uint128 emb) = _take(lotId, grams);
        _lots[childId] = Lot({
            stage: lot.stage,
            owner: to,
            producedAt: lot.producedAt,
            revoked: false,
            totalG: grams,
            recycledG: rec,
            remainingG: grams,
            recycledRemainingG: rec,
            embeddedCo2eG: emb,
            embeddedRemainingG: emb,
            certHash: certHash,
            evidenceRoot: lot.evidenceRoot
        });
        _parents[childId].push(lotId);
        emit Shipped(lotId, childId, to, grams, certHash);
    }

    /// @notice A certifier freezes a lot after finding a problem. Frozen lots cannot be used,
    ///         shipped or put on a passport; verifiers also flag every descendant.
    function revokeLot(uint256 lotId, bytes32 reasonHash) external onlyCertifier {
        if (_lots[lotId].stage == Stage.None) revert UnknownLot(lotId);
        _lots[lotId].revoked = true;
        emit LotRevoked(lotId, msg.sender, reasonHash);
    }

    /// @notice The brand that owns a garment lot issues its passport, once.
    function mintPassport(uint256 lotId, bytes32 claimHash) external {
        Lot storage lot = _lots[lotId];
        if (lot.stage != Stage.Garment) revert NotGarment(lotId);
        if (lot.owner != msg.sender) revert NotLotOwner(lotId);
        if (roleOf[msg.sender] != Role.Brand) revert WrongRole(msg.sender, Role.Brand);
        if (lot.revoked) revert LotIsRevoked(lotId);
        if (_passports[lotId].mintedAt != 0) revert PassportExists(lotId);

        uint16 bps = uint16((uint256(lot.recycledG) * 10000) / lot.totalG);
        uint32 perKg = uint32((uint256(lot.embeddedCo2eG) * 1000) / lot.totalG);
        _passports[lotId] = Passport(lotId, msg.sender, bps, perKg, claimHash, uint64(block.timestamp));
        emit PassportMinted(lotId, msg.sender, bps, perKg, claimHash);
    }

    // ------------------------------------------------------------------ views

    function getLot(uint256 lotId) external view returns (Lot memory) {
        return _lots[lotId];
    }

    function getParents(uint256 lotId) external view returns (uint256[] memory) {
        return _parents[lotId];
    }

    function getPassport(uint256 lotId) external view returns (Passport memory) {
        return _passports[lotId];
    }

    function transformDigest(address owner, TransformRequest calldata r) external view returns (bytes32) {
        return _hashTypedDataV4(_transformStructHash(owner, r));
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ------------------------------------------------------------------ internals

    function _consumeAll(TransformRequest calldata r, Stage from, uint256 intoLotId)
        internal
        returns (uint64 totalIn, uint64 recycledIn, uint128 embeddedIn)
    {
        for (uint256 i = 0; i < r.inputLotIds.length; i++) {
            uint256 id = r.inputLotIds[i];
            Lot storage lot = _lots[id];
            if (lot.stage == Stage.None) revert UnknownLot(id);
            if (lot.stage != from) revert StageMismatch(id);
            if (lot.owner != msg.sender) revert NotLotOwner(id);
            if (r.producedAt < lot.producedAt) revert ProducedBeforeInput(id);
            for (uint256 j = 0; j < i; j++) {
                if (r.inputLotIds[j] == id) revert DuplicateInput(id);
            }
            (uint64 rec, uint128 emb) = _take(id, r.consumeG[i]);
            totalIn += r.consumeG[i];
            recycledIn += rec;
            embeddedIn += emb;
            _parents[intoLotId].push(id);
            emit Consumed(id, intoLotId, r.consumeG[i], rec);
        }
    }

    /// @dev Removes `grams` from a lot and returns the recycled mass and CO2e that go with it.
    function _take(uint256 lotId, uint64 grams) internal returns (uint64 rec, uint128 emb) {
        Lot storage lot = _lots[lotId];
        if (lot.revoked) revert LotIsRevoked(lotId);
        if (grams == 0) revert ZeroAmount();
        if (grams > lot.remainingG) revert InsufficientLot(lotId, grams, lot.remainingG);

        if (grams == lot.remainingG) {
            rec = lot.recycledRemainingG;
            emb = lot.embeddedRemainingG;
        } else {
            rec = uint64((uint256(lot.recycledRemainingG) * grams) / lot.remainingG);
            emb = uint128((uint256(lot.embeddedRemainingG) * grams) / lot.remainingG);
        }
        lot.remainingG -= grams;
        lot.recycledRemainingG -= rec;
        lot.embeddedRemainingG -= emb;
    }

    function _useCert(bytes32 certHash, bool required) internal {
        if (certHash == bytes32(0)) {
            if (required) revert ZeroCertificate();
            return;
        }
        if (certUsed[certHash]) revert CertificateAlreadyUsed(certHash);
        certUsed[certHash] = true;
    }

    function _roleFor(Stage s) internal pure returns (Role) {
        if (s == Stage.Flake || s == Stage.Chip) return Role.Recycler;
        if (s == Stage.Yarn) return Role.Spinner;
        if (s == Stage.Fabric) return Role.FabricMill;
        if (s == Stage.Garment) return Role.GarmentMaker;
        return Role.None;
    }

    function _recoverTransformSigner(address owner, TransformRequest calldata r, bytes calldata sig)
        internal
        view
        returns (address)
    {
        (address signer, ECDSA.RecoverError err,) = ECDSA.tryRecover(_hashTypedDataV4(_transformStructHash(owner, r)), sig);
        if (err != ECDSA.RecoverError.NoError) revert NotCertifier(address(0));
        return signer;
    }

    function _transformStructHash(address owner, TransformRequest calldata r) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                TRANSFORM_TYPEHASH,
                owner,
                keccak256(abi.encodePacked(r.inputLotIds)),
                keccak256(abi.encodePacked(r.consumeG)),
                r.virginG,
                uint8(r.outputStage),
                r.outputTotalG,
                r.outputRecycledG,
                r.processCo2eG,
                r.producedAt,
                r.certHash,
                r.evidenceRoot
            )
        );
    }
}
