"""End-to-end test against the REAL running server (real Gemini + Sarvam).

1. Start the server in one window:   uvicorn app.main:app --host 0.0.0.0 --port 8000
2. In a second window (venv active): python live_test.py
   Optional: python live_test.py http://<other-server>:8000

Uses the generated images in tests/samples/generated/ plus any of YOUR photos in tests/samples/real/:
  notes*.jpg   money you would pay (e.g. one 500 note)      -> /money count + check
  change*.jpg  change you got back (e.g. one 50 note)        -> /money change
  fake*.jpg    a toy note from a shop ("Children Bank" etc) -> /money check (should be flagged)
  waste*.jpg   an item to throw away (bottle, peel...)       -> /waste
  scene*.jpg   a room or corridor                            -> /describe
  bill*.jpg    any real shop bill                            -> /read
Full responses are saved to tests/live_results.json.
"""
import json
import sys
import time
import uuid
from pathlib import Path

import httpx

# 127.0.0.1, not "localhost": on Windows "localhost" tries IPv6 first and adds ~2 s to every call
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
HERE = Path(__file__).resolve().parent
GEN = HERE / "tests" / "samples" / "generated"
REAL = HERE / "tests" / "samples" / "real"
RUN = uuid.uuid4().hex[:6]
SLOW = {"/guidance": 3.0}          # seconds; everything else: 8 s
results, saved = [], []


def mime(p: Path) -> str:
    return {".pdf": "application/pdf", ".png": "image/png", ".webp": "image/webp"}.get(p.suffix.lower(), "image/jpeg")


def call(path, file=None, field="image", **data):
    """One request; on a free-tier rate limit (429) wait and retry, so quota isn't reported as a wrong answer."""
    files = {field: (file.name, file.read_bytes(), mime(file))} if file else None
    for attempt in range(3):
        start = time.time()
        r = httpx.post(BASE + path, data={k: str(v) for k, v in data.items()}, files=files, timeout=120)
        took = time.time() - start
        is_json = r.headers.get("content-type", "").startswith("application/json")
        body = r.json() if is_json else None
        limited = isinstance(body, dict) and "rate limit" in str(body.get("error", ""))
        if not limited or attempt == 2:
            return r, body, took
        print(f"        rate limit hit on {path}, waiting 30 s and retrying ({attempt + 1}/2)...")
        time.sleep(30)


def record(name, path, status, took, body, note=""):
    limit = SLOW.get(path, 8.0)
    flag = " SLOW" if took > limit else ""
    speech = (body or {}).get("speech", "") if isinstance(body, dict) else ""
    results.append((status, took, name, note or speech, flag))
    saved.append({"test": name, "endpoint": path, "status": status, "seconds": round(took, 2), "response": body})
    print(f"{status:<6}{flag:<5} {took:5.1f}s  {name:<34} {(note or speech)[:120]}")


def check(name, path, cond_fn, file=None, field="image", soft=False, **data):
    """Run one call; cond_fn(body) -> (ok, note). soft=True turns a failure into CHECK (AI judgement call)."""
    try:
        r, body, took = call(path, file, field, **data)
    except httpx.HTTPError as exc:
        record(name, path, "FAIL", 0, None, f"request failed: {exc}")
        return None
    if body is None and r.status_code == 200:
        ok, note = cond_fn(r)
    elif body is None:
        ok, note = False, f"HTTP {r.status_code}: {r.text[:150]}"
    else:
        try:
            ok, note = cond_fn(body)
        except Exception as exc:  # unexpected shape
            ok, note = False, f"unexpected response ({exc}): {json.dumps(body)[:150]}"
    status = "PASS" if ok else ("CHECK" if soft else "FAIL")
    record(name, path, status, took, body, "" if ok and not note else note)
    return body


def gen(name):
    p = GEN / name
    if not p.exists():
        print(f"missing {p}. Run: python tests/make_samples.py")
        sys.exit(1)
    return p


def real(prefix):
    return sorted(p for p in REAL.glob(prefix + "*") if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp")) if REAL.exists() else []


def main():
    try:
        httpx.get(BASE + "/health", timeout=5).raise_for_status()
    except Exception:
        print(f"Server not reachable at {BASE}. Start it first:\n  uvicorn app.main:app --host 0.0.0.0 --port 8000")
        sys.exit(1)
    print(f"Testing {BASE}  (run {RUN})\n" + "-" * 110)

    s_bill, s_letter, s_pdf, s_money = (f"{RUN}-{x}" for x in ("bill", "letter", "pdf", "money"))
    b = lambda body: body["bill"]  # noqa: E731

    # ---------------- Read: bills ----------------
    check("bill: correct total", "/read",
          lambda x: (x["kind"] == "bill" and b(x)["computed_total"] == 1099 and not b(x)["mismatch"],
                     f"computed {b(x)['computed_total']} printed {b(x)['printed_total']} mismatch={b(x)['mismatch']}"),
          gen("bill_correct.jpg"), "file", lang="en", session_id=s_bill)
    check("bill: OVERCHARGED caught", "/read",
          lambda x: (b(x)["mismatch"] and b(x)["computed_total"] == 1099 and b(x)["printed_total"] == 1199, ""),
          gen("bill_overcharged.jpg"), "file", lang="en", session_id=s_bill + "o")
    check("bill: overcharged, Hindi", "/read",
          lambda x: (b(x)["mismatch"] and "रुपये" in x["speech"], ""),
          gen("bill_overcharged.jpg"), "file", lang="hi", session_id=s_bill + "h")
    check("bill: two bills in photo", "/read",
          lambda x: ("multiple_bills" in x["uncertain"], ""),
          gen("two_bills.jpg"), "file", soft=True, lang="en", session_id=s_bill + "2")

    # ---------------- Read: documents + questions ----------------
    check("letter (photo): document", "/read",
          lambda x: (x["kind"] == "document", ""), gen("letter.jpg"), "file", lang="en", session_id=s_letter)
    check("ask: due date", "/read/ask",
          lambda x: ("november" in x["speech"].lower() and "10" in x["speech"], ""),
          question="When do I have to pay this bill?", lang="en", session_id=s_letter)
    check("ask: not in document", "/read/ask",
          lambda x: (len(x["speech"]) > 0, "should say it is not mentioned: " + x["speech"]),
          soft=True, question="What is the customer's blood group?", lang="en", session_id=s_letter)
    check("letter (PDF): document", "/read",
          lambda x: (x["kind"] == "document", ""), gen("letter.pdf"), "file", lang="en", session_id=s_pdf)
    check("ask in Hindi: amount", "/read/ask",
          lambda x: (any(n in x["speech"] for n in ("1,240", "1240", "१२४०")), ""),
          question="बिल कितने रुपये का है?", lang="hi", session_id=s_pdf)

    # ---------------- Read: camera guidance ----------------
    check("guidance: half out of frame", "/guidance",
          lambda x: (not x["ready"], f"move={x['move']} ready={x['ready']}"),
          gen("letter_cut_off.jpg"), target="document", lang="en", session_id=RUN)
    check("guidance: full document", "/guidance",
          lambda x: (x["ready"], f"move={x['move']} ready={x['ready']}"),
          gen("letter.jpg"), soft=True, target="document", lang="en", session_id=RUN)
    check("guidance: too dark", "/guidance",
          lambda x: (not x["ready"], f"move={x['move']} ready={x['ready']}"),
          gen("too_dark.jpg"), target="document", lang="en", session_id=RUN)

    # ---------------- Navigate ----------------
    check("sign: EXIT GATE 2", "/sign",
          lambda x: ("EXIT" in x["text"].upper() and "2" in x["text"], ""),
          gen("sign_exit.jpg"), lang="en", session_id=RUN)
    check("describe: sign on wall", "/describe",
          lambda x: (len(x["speech"]) > 0, ""), gen("sign_exit.jpg"), soft=True, lang="en", session_id=RUN)
    check("waste: dark photo -> no bin", "/waste",
          lambda x: (x["bin_color"] is None, f"bin={x['bin_color']} {x['speech']}"),
          gen("too_dark.jpg"), lang="en", session_id=RUN)

    # ---------------- Voice + errors ----------------
    check("tts: Hindi voice", "/tts",
          lambda r: (r.headers.get("content-type", "").startswith("audio") and len(r.content) > 5000,
                     f"{len(r.content):,} bytes of audio"),
          text="नमस्ते, साथी तैयार है।", lang="hi")
    check("error: PDF to /waste -> 400", "/waste",
          lambda x: ("error" in x and x["speech"], x.get("error", "")), gen("letter.pdf"), lang="en")
    check("error: ask before reading", "/read/ask",
          lambda x: (x["speech"] == "Please read a document first.", ""), question="?", lang="en", session_id="nobody-" + RUN)

    # ---------------- Your real photos ----------------
    print("-" * 110 + "\nYour photos (tests/samples/real/):")
    notes, change, fakes = real("notes"), real("change"), real("fake")
    if notes:
        call("/read", gen("bill_correct.jpg"), "file", lang="en", session_id=s_money)  # bill of 1,099
        check(f"money count: {notes[0].name}", "/money", lambda x: (x["total"] > 0 and not x["unclear"], ""),
              notes[0], soft=True, mode="count", lang="en", session_id=s_money)
        for p in notes:
            check(f"note check (real): {p.name}", "/money", lambda x: (not x["suspicious"], ""),
                  p, soft=True, mode="check", lang="en", session_id=RUN)
    else:
        record("money count / note check", "/money", "SKIP", 0, None, "add notes*.jpg (e.g. a 500 note, spread flat)")
    if change and notes:
        check(f"change check: {change[0].name}", "/money", lambda x: (x["expected_change"] is not None, ""),
              change[0], soft=True, mode="change", lang="en", session_id=s_money)
    elif notes:
        # no change photo: pretend the user paid 1,599 for the 1,099 bill and got the photographed note back as change
        check(f"change check (paid 1,599, change = {notes[0].name})", "/money",
              lambda x: (x["expected_change"] == 500 and x["difference"] == 0 and "Correct change" in x["speech"],
                         f"expected {x['expected_change']} diff {x['difference']}: {x['speech']}"),
              notes[0], mode="change", paid=1599, lang="en", session_id=s_money)
    else:
        record("change check", "/money", "SKIP", 0, None, "add change*.jpg (needs notes*.jpg too)")
    for p in fakes:
        check(f"FAKE flagged: {p.name}", "/money", lambda x: (bool(x["suspicious"]), ""),
              p, mode="check", lang="en", session_id=RUN)
    if not fakes:
        record("fake note flagged", "/money", "SKIP", 0, None, "add fake*.jpg (a shop-bought toy note, e.g. Children Bank)")
    check("waste: drawn plastic bottle", "/waste",
          lambda x: (x["bin_color"] == "blue" and x["category"] == "dry", f"bin={x['bin_color']} {x['speech']}"),
          gen("waste_bottle.jpg"), lang="en", session_id=RUN)
    for p in real("waste") or [None]:
        if p is None:
            record("waste item (real photo)", "/waste", "SKIP", 0, None, "optional: add waste*.jpg, a real phone photo")
        else:
            check(f"waste: {p.name}", "/waste", lambda x: (x["bin_color"] is not None, f"bin={x['bin_color']} {x['speech']}"),
                  p, soft=True, lang="en", session_id=RUN)
    for p in real("scene"):
        check(f"describe: {p.name}", "/describe", lambda x: (True, ""), p, soft=True, lang="en", session_id=RUN)
    for p in real("bill"):
        check(f"real bill: {p.name}", "/read", lambda x: (x["kind"] == "bill", ""), p, "file", soft=True,
              lang="en", session_id=RUN + p.stem)

    # ---------------- Summary ----------------
    counts = {s: sum(1 for r in results if r[0] == s) for s in ("PASS", "FAIL", "CHECK", "SKIP")}
    timed = [r[1] for r in results if r[1] > 0]
    slow = [r[2] for r in results if r[4]]
    print("-" * 110)
    print("  ".join(f"{k}: {v}" for k, v in counts.items()),
          f"| avg {sum(timed) / max(len(timed), 1):.1f}s, max {max(timed, default=0):.1f}s",
          f"| slow: {', '.join(slow) if slow else 'none'}")
    print("PASS = automatic check passed · FAIL = wrong answer · CHECK = AI judgement, read the speech yourself · SKIP = photo missing")
    out = HERE / "tests" / "live_results.json"
    out.write_text(json.dumps(saved, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Full responses saved to {out}")
    sys.exit(1 if counts["FAIL"] else 0)


if __name__ == "__main__":
    main()
