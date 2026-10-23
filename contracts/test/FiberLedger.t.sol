// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {FiberLedger} from "../src/FiberLedger.sol";

contract FiberLedgerTest is Test {
    FiberLedger ledger;

    uint256 certPk = 0xC0FFEE;
    uint256 roguePk = 0xBAD;
    address certifier;
    address recycler = makeAddr("recycler-adana");
    address spinner = makeAddr("spinner-gaziantep");
    address mill = makeAddr("fabric-mill-bursa");
    address maker = makeAddr("garment-maker-denizli");
    address brand = makeAddr("brand-amsterdam");
    address brand2 = makeAddr("brand-two");

    uint64 constant T = 1_000_000; // grams per tonne
    uint64 constant DAY = 1 days;

    function setUp() public {
        vm.warp(1_790_000_000);
        ledger = new FiberLedger();
        certifier = vm.addr(certPk);
        ledger.setCertifier(certifier, true, keccak256("ml-dsa-44 public key"));

        ledger.registerParty(recycler, FiberLedger.Role.Recycler, keccak256("party:recycler"));
        ledger.registerParty(spinner, FiberLedger.Role.Spinner, keccak256("party:spinner"));
        ledger.registerParty(mill, FiberLedger.Role.FabricMill, keccak256("party:mill"));
        ledger.registerParty(maker, FiberLedger.Role.GarmentMaker, keccak256("party:maker"));
        ledger.registerParty(brand, FiberLedger.Role.Brand, keccak256("party:brand"));
        ledger.registerParty(brand2, FiberLedger.Role.Brand, keccak256("party:brand2"));

        ledger.setMaxYield(FiberLedger.Stage.Bale, FiberLedger.Stage.Flake, 7500);
        ledger.setMaxYield(FiberLedger.Stage.Flake, FiberLedger.Stage.Chip, 9700);
        ledger.setMaxYield(FiberLedger.Stage.Chip, FiberLedger.Stage.Yarn, 9700);
        ledger.setMaxYield(FiberLedger.Stage.Yarn, FiberLedger.Stage.Fabric, 9200);
        ledger.setMaxYield(FiberLedger.Stage.Fabric, FiberLedger.Stage.Garment, 8500);
        ledger.setVirginFactor(FiberLedger.Stage.Chip, 2700); // virgin PET chip, g CO2e per kg
    }

    // ------------------------------------------------------------------ helpers

    function _ids(uint256 a) internal pure returns (uint256[] memory x) {
        x = new uint256[](1);
        x[0] = a;
    }

    function _g(uint64 a) internal pure returns (uint64[] memory x) {
        x = new uint64[](1);
        x[0] = a;
    }

    function _req(
        uint256 inputId,
        uint64 consume,
        uint64 virgin,
        FiberLedger.Stage out,
        uint64 total,
        uint64 recycled,
        uint128 processCo2e,
        bytes32 cert
    ) internal view returns (FiberLedger.TransformRequest memory r) {
        r.inputLotIds = _ids(inputId);
        r.consumeG = _g(consume);
        r.virginG = virgin;
        r.outputStage = out;
        r.outputTotalG = total;
        r.outputRecycledG = recycled;
        r.processCo2eG = processCo2e;
        r.producedAt = uint64(block.timestamp);
        r.certHash = cert;
        r.evidenceRoot = keccak256(abi.encode("evidence", cert));
    }

    function _sign(uint256 pk, address owner, FiberLedger.TransformRequest memory r) internal view returns (bytes memory) {
        (uint8 v, bytes32 rr, bytes32 s) = vm.sign(pk, ledger.transformDigest(owner, r));
        return abi.encodePacked(rr, s, v);
    }

    function _transform(address owner, FiberLedger.TransformRequest memory r) internal returns (uint256) {
        bytes memory sig = _sign(certPk, owner, r);
        vm.prank(owner);
        return ledger.transform(r, sig);
    }

    /// Bale (80 t) -> flake (56 t) -> chip (54 t), all recycled; returns the chip lot.
    function _recycledChips() internal returns (uint256 chipId) {
        vm.prank(certifier);
        uint256 bale = ledger.registerInput(
            recycler, 80 * T, 8_000_000, uint64(block.timestamp - DAY), keccak256("TC-BALE-001"), bytes32("ev")
        );
        uint256 flake = _transform(
            recycler, _req(bale, 80 * T, 0, FiberLedger.Stage.Flake, 56 * T, 56 * T, 14_000_000, keccak256("SC-FLAKE-001"))
        );
        chipId = _transform(
            recycler, _req(flake, 56 * T, 0, FiberLedger.Stage.Chip, 54 * T, 54 * T, 18_900_000, keccak256("SC-CHIP-001"))
        );
    }

    /// Ships 30 t of recycled chips to the spinner; returns the spinner's lot.
    function _chipsAtSpinner() internal returns (uint256) {
        uint256 chip = _recycledChips();
        vm.prank(recycler);
        return ledger.ship(chip, 30 * T, spinner, keccak256("TC-CHIP-SHIP-001"));
    }

    // ------------------------------------------------------------------ honest path

    function test_HonestChain_EndsInPassport() public {
        uint256 chips = _chipsAtSpinner();

        // 30 t recycled chips + 22 t virgin chips -> 50 t yarn, 28.8 t of it recycled (57.6%).
        uint256 yarn = _transform(
            spinner, _req(chips, 30 * T, 22 * T, FiberLedger.Stage.Yarn, 50 * T, 28_800_000, 40_000_000, keccak256("SC-YARN-001"))
        );
        vm.prank(spinner);
        uint256 yarnAtMill = ledger.ship(yarn, 50 * T, mill, keccak256("TC-YARN-SHIP-001"));

        uint256 fabric = _transform(
            mill, _req(yarnAtMill, 50 * T, 0, FiberLedger.Stage.Fabric, 46 * T, 26_400_000, 55_000_000, keccak256("SC-FAB-001"))
        );
        vm.prank(mill);
        uint256 fabricAtMaker = ledger.ship(fabric, 46 * T, maker, keccak256("TC-FAB-SHIP-001"));

        uint256 garment = _transform(
            maker, _req(fabricAtMaker, 46 * T, 0, FiberLedger.Stage.Garment, 39 * T, 22_400_000, 20_000_000, keccak256("SC-GAR-001"))
        );
        vm.prank(maker);
        uint256 garmentAtBrand = ledger.ship(garment, 39 * T, brand, keccak256("TC-GAR-SHIP-001"));

        vm.prank(brand);
        ledger.mintPassport(garmentAtBrand, keccak256("Shell: 57% recycled polyester, verified."));

        FiberLedger.Passport memory p = ledger.getPassport(garmentAtBrand);
        assertEq(p.brand, brand);
        assertEq(p.recycledBps, 5743); // 22.4 / 39
        assertGt(p.co2eGPerKg, 0);

        // Parents link back so a verifier can walk the chain.
        assertEq(ledger.getParents(garmentAtBrand)[0], garment);
        assertEq(ledger.getParents(yarn)[0], chips);
    }

    function test_CarbonIsPropagatedByTheContract() public {
        uint256 chips = _chipsAtSpinner();
        FiberLedger.Lot memory c = ledger.getLot(chips);
        // 30 of 54 t of chips carry 30/54 of the chip lot's embedded CO2e (8 + 14 + 18.9 t).
        assertEq(c.embeddedCo2eG, uint128((uint256(40_900_000) * 30) / 54));

        uint256 yarn = _transform(
            spinner, _req(chips, 30 * T, 22 * T, FiberLedger.Stage.Yarn, 50 * T, 28_800_000, 40_000_000, keccak256("SC-YARN-001"))
        );
        // inputs + 22 t virgin chip x 2.7 kg/kg + spinning energy
        uint128 expected = c.embeddedCo2eG + 22 * T * 2700 / 1000 + 40_000_000;
        assertEq(ledger.getLot(yarn).embeddedCo2eG, expected);
    }

    function test_PartialConsumptionKeepsBalances() public {
        uint256 chip = _recycledChips();
        vm.prank(recycler);
        ledger.ship(chip, 10 * T, spinner, keccak256("TC-A"));
        FiberLedger.Lot memory left = ledger.getLot(chip);
        assertEq(left.remainingG, 44 * T);
        assertEq(left.recycledRemainingG, 44 * T);
    }

    // ------------------------------------------------------------------ fraud is refused

    /// The core demo: 100% recycled yarn claimed from inputs that were only partly recycled.
    /// The certifier even signed it, and the contract still refuses.
    function test_OverClaimRecycled_RevertsEvenWithValidSignature() public {
        uint256 chips = _chipsAtSpinner();
        FiberLedger.TransformRequest memory r =
            _req(chips, 30 * T, 22 * T, FiberLedger.Stage.Yarn, 50 * T, 50 * T, 40_000_000, keccak256("SC-YARN-FAKE"));
        bytes memory sig = _sign(certPk, spinner, r);
        vm.prank(spinner);
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.RecycledExceedsInputs.selector, 50 * T, 29_100_000));
        ledger.transform(r, sig);
    }

    function test_MassFromNowhere_Reverts() public {
        uint256 chips = _chipsAtSpinner();
        // 30 t in, no virgin declared, 40 t out.
        FiberLedger.TransformRequest memory r =
            _req(chips, 30 * T, 0, FiberLedger.Stage.Yarn, 40 * T, 20 * T, 1, keccak256("SC-YARN-X"));
        bytes memory sig = _sign(certPk, spinner, r);
        vm.prank(spinner);
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.MassExceedsInputs.selector, 40 * T, 29_100_000));
        ledger.transform(r, sig);
    }

    function test_SameCertificateTwice_Reverts() public {
        uint256 chip = _recycledChips();
        vm.startPrank(recycler);
        ledger.ship(chip, 20 * T, spinner, keccak256("TC-CHIP-SHIP-777"));
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.CertificateAlreadyUsed.selector, keccak256("TC-CHIP-SHIP-777")));
        ledger.ship(chip, 20 * T, spinner, keccak256("TC-CHIP-SHIP-777"));
        vm.stopPrank();
    }

    function test_ShipMoreThanOwned_Reverts() public {
        uint256 chip = _recycledChips();
        vm.prank(recycler);
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.InsufficientLot.selector, chip, 60 * T, 54 * T));
        ledger.ship(chip, 60 * T, spinner, keccak256("TC-TOO-MUCH"));
    }

    function test_ConsumeSameLotTwice_Reverts() public {
        uint256 chips = _chipsAtSpinner();
        _transform(
            spinner, _req(chips, 30 * T, 0, FiberLedger.Stage.Yarn, 29 * T, 29 * T, 1, keccak256("SC-Y1"))
        );
        FiberLedger.TransformRequest memory r =
            _req(chips, 30 * T, 0, FiberLedger.Stage.Yarn, 29 * T, 29 * T, 1, keccak256("SC-Y2"));
        bytes memory sig = _sign(certPk, spinner, r);
        vm.prank(spinner);
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.InsufficientLot.selector, chips, 30 * T, 0));
        ledger.transform(r, sig);
    }

    function test_DuplicateInputInOneStep_Reverts() public {
        uint256 chips = _chipsAtSpinner();
        FiberLedger.TransformRequest memory r =
            _req(chips, 10 * T, 0, FiberLedger.Stage.Yarn, 15 * T, 15 * T, 1, keccak256("SC-DUP"));
        r.inputLotIds = new uint256[](2);
        r.inputLotIds[0] = chips;
        r.inputLotIds[1] = chips;
        r.consumeG = new uint64[](2);
        r.consumeG[0] = 10 * T;
        r.consumeG[1] = 10 * T;
        bytes memory sig = _sign(certPk, spinner, r);
        vm.prank(spinner);
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.DuplicateInput.selector, chips));
        ledger.transform(r, sig);
    }

    // ------------------------------------------------------------------ signatures and roles

    function test_SignatureFromNonCertifier_Reverts() public {
        uint256 chips = _chipsAtSpinner();
        FiberLedger.TransformRequest memory r =
            _req(chips, 30 * T, 0, FiberLedger.Stage.Yarn, 29 * T, 29 * T, 1, keccak256("SC-ROGUE"));
        bytes memory sig = _sign(roguePk, spinner, r);
        vm.prank(spinner);
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.NotCertifier.selector, vm.addr(roguePk)));
        ledger.transform(r, sig);
    }

    function test_EditedAfterSigning_Reverts() public {
        uint256 chips = _chipsAtSpinner();
        FiberLedger.TransformRequest memory r =
            _req(chips, 30 * T, 22 * T, FiberLedger.Stage.Yarn, 50 * T, 28 * T, 1, keccak256("SC-EDIT"));
        bytes memory sig = _sign(certPk, spinner, r);
        r.outputRecycledG = 29 * T; // spinner bumps the number after approval
        vm.prank(spinner);
        // The recovered signer is some unrelated address, so it is not a certifier.
        vm.expectRevert();
        ledger.transform(r, sig);
    }

    function test_ApprovalForAnotherParty_Reverts() public {
        uint256 chips = _chipsAtSpinner();
        FiberLedger.TransformRequest memory r =
            _req(chips, 30 * T, 0, FiberLedger.Stage.Yarn, 29 * T, 29 * T, 1, keccak256("SC-OTHER"));
        bytes memory sig = _sign(certPk, mill, r); // signed for the mill, submitted by the spinner
        vm.prank(spinner);
        vm.expectRevert();
        ledger.transform(r, sig);
    }

    function test_ReplayedApproval_Reverts() public {
        uint256 chip = _recycledChips();
        vm.prank(recycler);
        uint256 a = ledger.ship(chip, 20 * T, spinner, keccak256("TC-R1"));
        FiberLedger.TransformRequest memory r =
            _req(a, 10 * T, 0, FiberLedger.Stage.Yarn, 9 * T, 9 * T, 1, keccak256("SC-REPLAY"));
        bytes memory sig = _sign(certPk, spinner, r);
        vm.startPrank(spinner);
        ledger.transform(r, sig);
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.CertificateAlreadyUsed.selector, keccak256("SC-REPLAY")));
        ledger.transform(r, sig);
        vm.stopPrank();
    }

    function test_WrongRoleForStage_Reverts() public {
        uint256 chips = _chipsAtSpinner();
        vm.prank(spinner);
        ledger.ship(chips, 30 * T, mill, keccak256("TC-TO-MILL"));
        uint256 atMill = ledger.lotCount();
        FiberLedger.TransformRequest memory r =
            _req(atMill, 30 * T, 0, FiberLedger.Stage.Yarn, 29 * T, 29 * T, 1, keccak256("SC-ROLE"));
        bytes memory sig = _sign(certPk, mill, r);
        vm.prank(mill);
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.WrongRole.selector, mill, FiberLedger.Role.Spinner));
        ledger.transform(r, sig);
    }

    function test_SkippingAStage_Reverts() public {
        uint256 chips = _chipsAtSpinner();
        vm.prank(spinner);
        ledger.ship(chips, 30 * T, mill, keccak256("TC-SKIP"));
        uint256 atMill = ledger.lotCount();
        FiberLedger.TransformRequest memory r =
            _req(atMill, 30 * T, 0, FiberLedger.Stage.Fabric, 29 * T, 29 * T, 1, keccak256("SC-SKIP"));
        bytes memory sig = _sign(certPk, mill, r);
        vm.prank(mill);
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.BadTransition.selector, FiberLedger.Stage.Chip, FiberLedger.Stage.Fabric));
        ledger.transform(r, sig);
    }

    function test_NotOwnerOfInput_Reverts() public {
        uint256 chip = _recycledChips(); // owned by the recycler
        FiberLedger.TransformRequest memory r =
            _req(chip, 10 * T, 0, FiberLedger.Stage.Yarn, 9 * T, 9 * T, 1, keccak256("SC-STEAL"));
        bytes memory sig = _sign(certPk, spinner, r);
        vm.prank(spinner);
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.NotLotOwner.selector, chip));
        ledger.transform(r, sig);
    }

    function test_OnlyCertifierRegistersInput() public {
        vm.prank(recycler);
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.NotCertifier.selector, recycler));
        ledger.registerInput(recycler, T, 0, uint64(block.timestamp), keccak256("TC-SELF"), bytes32(0));
    }

    function test_OnlyAdminConfigures() public {
        vm.prank(recycler);
        vm.expectRevert(FiberLedger.NotAdmin.selector);
        ledger.setMaxYield(FiberLedger.Stage.Chip, FiberLedger.Stage.Yarn, 10000);
    }

    // ------------------------------------------------------------------ time

    function test_OutputDatedBeforeInput_Reverts() public {
        uint256 chips = _chipsAtSpinner();
        FiberLedger.TransformRequest memory r =
            _req(chips, 30 * T, 0, FiberLedger.Stage.Yarn, 29 * T, 29 * T, 1, keccak256("SC-EARLY"));
        r.producedAt = uint64(block.timestamp - 10 * DAY);
        bytes memory sig = _sign(certPk, spinner, r);
        vm.prank(spinner);
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.ProducedBeforeInput.selector, chips));
        ledger.transform(r, sig);
    }

    // ------------------------------------------------------------------ revocation and passports

    function test_RevokedLotIsFrozen() public {
        uint256 chips = _chipsAtSpinner();
        vm.prank(certifier);
        ledger.revokeLot(chips, keccak256("lab test: 0% recycled"));
        FiberLedger.TransformRequest memory r =
            _req(chips, 30 * T, 0, FiberLedger.Stage.Yarn, 29 * T, 29 * T, 1, keccak256("SC-FROZEN"));
        bytes memory sig = _sign(certPk, spinner, r);
        vm.prank(spinner);
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.LotIsRevoked.selector, chips));
        ledger.transform(r, sig);
    }

    function test_PassportOnlyOnceAndOnlyByBrand() public {
        uint256 chips = _chipsAtSpinner();
        uint256 yarn = _transform(
            spinner, _req(chips, 30 * T, 0, FiberLedger.Stage.Yarn, 29 * T, 29 * T, 1, keccak256("SC-Y"))
        );
        vm.prank(spinner);
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.NotGarment.selector, yarn));
        ledger.mintPassport(yarn, bytes32("claim"));

        vm.prank(spinner);
        uint256 y2 = ledger.ship(yarn, 29 * T, mill, keccak256("TC-Y"));
        uint256 fab = _transform(mill, _req(y2, 29 * T, 0, FiberLedger.Stage.Fabric, 26 * T, 26 * T, 1, keccak256("SC-F")));
        vm.prank(mill);
        uint256 f2 = ledger.ship(fab, 26 * T, maker, keccak256("TC-F"));
        uint256 gar = _transform(maker, _req(f2, 26 * T, 0, FiberLedger.Stage.Garment, 22 * T, 22 * T, 1, keccak256("SC-G")));

        vm.prank(maker);
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.WrongRole.selector, maker, FiberLedger.Role.Brand));
        ledger.mintPassport(gar, bytes32("claim"));

        vm.prank(maker);
        uint256 g2 = ledger.ship(gar, 22 * T, brand, keccak256("TC-G"));
        vm.startPrank(brand);
        ledger.mintPassport(g2, bytes32("claim"));
        vm.expectRevert(abi.encodeWithSelector(FiberLedger.PassportExists.selector, g2));
        ledger.mintPassport(g2, bytes32("claim"));
        vm.stopPrank();
        assertEq(ledger.getPassport(g2).recycledBps, 10000);
    }

    // ------------------------------------------------------------------ fuzz

    /// Whatever the spinner claims, recycled mass out never exceeds recycled mass in times the yield.
    function testFuzz_RecycledNeverCreated(uint64 virgin, uint64 total, uint64 recycled) public {
        uint256 chips = _chipsAtSpinner();
        virgin = uint64(bound(virgin, 0, 100 * T));
        total = uint64(bound(total, 1, 200 * T));
        recycled = uint64(bound(recycled, 0, total));
        FiberLedger.TransformRequest memory r =
            _req(chips, 30 * T, virgin, FiberLedger.Stage.Yarn, total, recycled, 1, keccak256("SC-FUZZ"));
        bytes memory sig = _sign(certPk, spinner, r);
        vm.prank(spinner);
        try ledger.transform(r, sig) returns (uint256 id) {
            FiberLedger.Lot memory y = ledger.getLot(id);
            assertLe(y.recycledG, (uint256(30 * T) * 9700) / 10000);
            assertLe(y.totalG, (uint256(30 * T + virgin) * 9700) / 10000);
        } catch {}
    }
}
