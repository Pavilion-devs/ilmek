"""Generates docs/architecture/ilmek-architecture.excalidraw (hand-drawn style, Excalifont).

    python3 docs/architecture/make_diagram.py
"""
import json
import random
from pathlib import Path

random.seed(7)
FONT = 5  # Excalifont
INK = "#1e1e1e"
MUTED = "#5c5c5c"
ACCENT = "#c55838"
GREEN = "#17392b"
els = []


def _id():
    return "".join(random.choice("abcdefghijklmnopqrstuvwxyz0123456789") for _ in range(16))


def base(kind, x, y, w, h, **kw):
    e = {
        "id": _id(), "type": kind, "x": x, "y": y, "width": w, "height": h, "angle": 0,
        "strokeColor": kw.get("stroke", INK), "backgroundColor": kw.get("bg", "transparent"),
        "fillStyle": "solid", "strokeWidth": kw.get("sw", 1), "strokeStyle": kw.get("style", "solid"),
        "roughness": 1, "opacity": 100, "groupIds": [], "frameId": None, "roundness": None,
        "seed": random.randint(1, 2**31), "version": 1, "versionNonce": random.randint(1, 2**31),
        "isDeleted": False, "boundElements": [], "updated": 1, "link": None, "locked": False,
    }
    return e


def text_size(text, size):
    lines = text.split("\n")
    w = max(len(l) for l in lines) * size * 0.52
    h = len(lines) * size * 1.25
    return w, h


def text(x, y, s, size=16, align="left", color=INK, container=None, w=None):
    tw, th = text_size(s, size)
    if w is None:
        # Free text is drawn into a box of this width, so be generous (Excalifont runs wide).
        caps = s == s.upper() and any(c.isalpha() for c in s)
        w = max(len(l) for l in s.split("\n")) * size * (0.78 if caps else 0.62)
    e = base("text", x, y, w, th, stroke=color)
    e.update({
        "text": s, "originalText": s, "fontSize": size, "fontFamily": FONT, "textAlign": align,
        "verticalAlign": "middle" if container else "top", "containerId": container,
        "lineHeight": 1.25, "autoResize": True,
    })
    els.append(e)
    return e


def box(x, y, w, h, label=None, size=16, style="solid", bg="transparent", stroke=INK, sw=1, color=INK):
    r = base("rectangle", x, y, w, h, style=style, bg=bg, stroke=stroke, sw=sw)
    els.append(r)
    if label:
        tw, th = text_size(label, size)
        t = text(x + (w - tw) / 2, y + (h - th) / 2, label, size, "center", color, container=r["id"], w=tw)
        r["boundElements"].append({"type": "text", "id": t["id"]})
    return r


def arrow(x1, y1, x2, y2, style="solid", label=None, lx=None, ly=None, size=14, color=INK):
    a = base("arrow", x1, y1, abs(x2 - x1), abs(y2 - y1), style=style, stroke=color)
    a.update({
        "points": [[0, 0], [x2 - x1, y2 - y1]], "lastCommittedPoint": None,
        "startBinding": None, "endBinding": None, "startArrowhead": None, "endArrowhead": "arrow",
        "elbowed": False,
    })
    els.append(a)
    if label:
        text(lx if lx is not None else (x1 + x2) / 2 + 10, ly if ly is not None else (y1 + y2) / 2 - 10, label, size, color=MUTED)
    return a


# ------------------------------------------------------------------ title
text(60, 50, "ILMEK\nARCHITECTURE", 40)
text(60, 160, "recycled fiber, counted once", 18, color=MUTED)

# ------------------------------------------------------------------ inputs
box(520, 30, 1040, 210)
text(1010, 42, "Inputs", 16)
box(545, 75, 320, 140, "Supply-chain documents\nPDF or photo\ntransaction certificates · invoices\nweighbridge tickets · meter bills")
box(880, 75, 320, 140, "Factory step records\ninputs · outputs · virgin added\nkWh · gas MJ · dates\ncertificate number")
box(1215, 75, 320, 140, "Certified bottle bales\nregistered by an accredited\ncertifier against their\ntransaction certificate")
arrow(1040, 240, 1040, 300, label="documents + step data · per lot", lx=1055, ly=258)

# ------------------------------------------------------------------ off-chain pipeline
box(60, 300, 1500, 360)
text(330, 312, "Off-chain pipeline · TypeScript (packages/core + packages/ai) · keys never reach the browser", 16)
row_y = 355
b1 = box(90, row_y, 330, 140, "Document AI\nClaude · structured output\nevery field + its exact quote\nrecorded responses for replay")
b2 = box(455, row_y, 330, 140, "Quote check\nquote must be in the PDF text\nvalue must be in the quote\nphotos → a person decides")
b3 = box(820, row_y, 330, 140, "Integrity engine · 8 checks\nphysical yield · energy per kg\ntiming · plant capacity\ncertificate reuse · robust z-score")
b4 = box(1185, row_y, 345, 140, "Certifier signs twice\nEIP-712 approval (ECDSA)\n+ ML-DSA-44 over the evidence root\nFIPS 204 · post-quantum")
arrow(420, row_y + 70, 455, row_y + 70)
arrow(785, row_y + 70, 820, row_y + 70)
arrow(1150, row_y + 70, 1185, row_y + 70)
box(90, 525, 330, 110, "Carbon per step\nkWh × 442 g CO₂e (Türkiye grid)\n+ gas MJ × 56.1 g (IPCC)", style="dashed")
box(455, 525, 1075, 110, "Evidence bundle → Merkle root\nstep record · integrity report · emission factors\nonly the root goes on-chain · documents stay private · brands choose what to share")

# Anthropic side box
box(1620, 340, 280, 120, "Anthropic API\nClaude · document reading\nClaude · label review")
arrow(1570, 400, 1620, 400, style="dashed")
text(1525, 470, "AI proposes, never writes\nto the ledger", 13, color=MUTED)

arrow(810, 660, 810, 720, label="signed step (EIP-712 + ML-DSA)", lx=825, ly=678)

# ------------------------------------------------------------------ ledger
box(60, 720, 1500, 290, stroke=GREEN, sw=2)
text(390, 732, "FiberLedger.sol · Base Sepolia · source verified on Sourcify (exact match)", 16, color=GREEN)
ly = 775
box(90, ly, 330, 130, "registerInput\ncertifier only\ncertified bales enter as kg")
box(455, ly, 330, 130, "transform\nconsumes its inputs\nrecycled out ≤ in × max yield\neven with a valid signature")
box(820, ly, 330, 130, "ship\nshipment certificate\nusable once, ledger-wide")
box(1185, ly, 345, 130, "mintPassport\nbrand only · once per lot\nlabel hash on-chain")
box(90, 925, 690, 65, "carries embedded CO₂e down the chain itself · lots can be frozen by a certifier", style="dashed", size=15)
box(820, 925, 710, 65, "refusals are real reverted transactions: RecycledExceedsInputs · CertificateAlreadyUsed", style="dashed", size=15, color=ACCENT, stroke=ACCENT)

# claim checker side
box(1620, 760, 280, 190, "Claim checker\nClaude sorts the brand's label\nunder EU Directive 2024/825\n→ number lock: only the\npassport's numbers, no\ngeneric green words\n→ else a safe template", size=15)
arrow(1620, 855, 1535, 840, label="approved label", lx=1540, ly=870, size=13)

# ------------------------------------------------------------------ decision
arrow(810, 1010, 810, 1070)
box(560, 1070, 500, 80, "accept   ·   refuse   ·   freeze", size=30)

box(90, 1070, 420, 80, "Tests: 22 Solidity (incl. fuzz) · 74 TypeScript\n36/36 AI fields confirmed against 5 PDFs", style="dashed", size=14)
box(1110, 1070, 450, 80, "Trust: the page's own server is untrusted\nthe chain is the source of truth", style="dashed", size=14)

# ------------------------------------------------------------------ outputs
oy = 1250
arrow(700, 1150, 330, oy, label="every lot, live", lx=420, ly=1180)
arrow(810, 1150, 810, oy, label="one passport per lot", lx=825, ly=1190)
arrow(920, 1150, 1290, oy, label="check any time", lx=1100, ly=1180)
box(90, oy, 480, 120, "Dashboard · React + Vite\noverview · lots · role workspaces\nalerts · ledger activity")
box(600, oy, 420, 120, "Garment passport · QR\n57% recycled · verified\nfiber CO₂e vs virgin · journey")
box(1050, oy, 510, 120, "Public verifier · in the browser\nwalks back to the certified bales\nMerkle roots · ML-DSA signatures · label hash\nlive Base Sepolia node or saved copy")
box(1620, oy + 10, 280, 100, "Shopper · customs · auditor\nscans the QR on the jacket")
arrow(1620, oy + 60, 1560, oy + 60)

# ------------------------------------------------------------------ tagline
text(90, 1430, "AI READS AND EXPLAINS\nPHYSICS DECIDES\nEVERY KILO IS COUNTED ONCE\nANYONE CAN CHECK", 34)
text(1050, 1440, "Istanbul → Adana → Gaziantep → Bursa → Denizli → Amsterdam\nno supplier names on-chain · documents stay off-chain\npnpm demo:base · github.com/Pavilion-devs/ilmek", 15, color=MUTED)

scene = {
    "type": "excalidraw", "version": 2, "source": "https://excalidraw.com",
    "elements": els, "appState": {"viewBackgroundColor": "#ffffff", "gridSize": None}, "files": {},
}
out = Path(__file__).with_name("ilmek-architecture.excalidraw")
out.write_text(json.dumps(scene, ensure_ascii=False, indent=1))
print(f"{len(els)} elements -> {out}")
