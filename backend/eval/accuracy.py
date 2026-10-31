"""Measure Read-mode accuracy on your own labelled photos (run it before and after a change, and show the numbers).

Put photos in one folder and name them by what is really in them:
  note_10_a.jpg            one 10 rupee note
  cash_500-100-10_b.jpg    a 500, a 100 and a 10 (any order)
  bill_1199_c.jpg          a shop bill whose printed total is 1199

Run (against the live backend or a local one):
  python eval/accuracy.py path/to/photos --url https://saathibackend.vercel.app
"""
import argparse
import re
import sys
import time
from collections import Counter
from pathlib import Path

import httpx


def truth(name: str):
    m = re.match(r"(note|cash|bill)_([\d\-.]+)", name)
    if not m:
        return None, None
    kind, nums = m.groups()
    values = [float(x) for x in nums.split("-") if x]
    return kind, values


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder")
    ap.add_argument("--url", default="http://127.0.0.1:8000")
    ap.add_argument("--lang", default="en")
    a = ap.parse_args()
    files = sorted(p for p in Path(a.folder).iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".webp"))
    if not files:
        sys.exit("No photos found")
    score = Counter()
    rows = []
    with httpx.Client(timeout=60) as http:
        for f in files:
            kind, want = truth(f.stem)
            if not kind:
                continue
            t0 = time.time()
            if kind == "bill":
                r = http.post(f"{a.url}/read", data={"lang": a.lang}, files={"file": (f.name, f.read_bytes(), "image/jpeg")}).json()
                got = (r.get("bill") or {}).get("printed_total")
                retake = "items" in r.get("uncertain", []) or "printed_total" in r.get("uncertain", [])
                ok = got is not None and abs(got - want[0]) < 1 and not retake
                result = "retake" if retake else got
            else:
                mode = "check" if kind == "note" else "count"
                r = http.post(f"{a.url}/money", data={"lang": a.lang, "mode": mode}, files={"image": (f.name, f.read_bytes(), "image/jpeg")}).json()
                seen = sorted(v for i in r.get("items", []) for v in [i["value"]] * i["count"])
                ok = seen == sorted(want) and not r.get("unclear")
                result = "asked again" if r.get("unclear") else seen
                if r.get("unclear"):
                    score[kind + " asked again"] += 1
            score[kind + " total"] += 1
            score[kind + " right"] += ok
            rows.append(f"{'OK ' if ok else 'XX '} {f.name:40s} want {want}  got {result}  ({time.time() - t0:.1f} s)")
    print("\n".join(rows))
    print()
    for kind in ("note", "cash", "bill"):
        n = score[kind + " total"]
        if n:
            extra = f", asked to retake {score[kind + ' asked again']}" if score[kind + " asked again"] else ""
            print(f"{kind:5s}: {score[kind + ' right']}/{n} right ({100 * score[kind + ' right'] / n:.0f}%){extra}")


if __name__ == "__main__":
    main()
