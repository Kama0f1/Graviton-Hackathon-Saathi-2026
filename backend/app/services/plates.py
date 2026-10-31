"""Number plate matching for "is this my cab?". OCR (by eye or by AI) confuses O/0, I/1, B/8 and so on,
so plates are compared after folding look-alike characters, and one wrong character is still a match."""
import re

LOOKALIKE = str.maketrans({"O": "0", "Q": "0", "D": "0", "I": "1", "L": "1", "Z": "2", "S": "5", "B": "8", "G": "6", "T": "7"})


def clean(plate: str) -> str:
    """ "pb-65 ab 1234" -> "PB65AB1234" """
    return re.sub(r"[^A-Z0-9]", "", plate.upper())


def fold(plate: str) -> str:
    return clean(plate).translate(LOOKALIKE)


def _one_off(a: str, b: str) -> bool:
    """True if a and b differ by at most one character (swap, missing or extra)."""
    if abs(len(a) - len(b)) > 1:
        return False
    if len(a) == len(b):
        return sum(x != y for x, y in zip(a, b)) <= 1
    if len(a) > len(b):
        a, b = b, a
    return any(a == b[:i] + b[i + 1:] for i in range(len(b)))


def same_plate(wanted: str, seen: str) -> bool:
    w, s = fold(wanted), fold(seen)
    if len(w) < 4 or len(s) < 4:
        return False
    if w == s or (len(w) >= 8 and _one_off(w, s)):
        return True
    # the user may give only the last digits ("1234"): those must match exactly
    return len(clean(wanted)) <= 4 and fold(seen).endswith(w)


def spoken(plate: str) -> str:
    """ "PB65AB1234" -> "P B 65 A B 12 34": letters one by one, digits in small groups, easy to follow by ear. """
    out = []
    for part in re.findall(r"[A-Z]+|\d+", clean(plate)):
        if part.isdigit():
            out.append(" ".join(part[i:i + 2] for i in range(0, len(part), 2)))
        else:
            out.append(" ".join(part))
    return " ".join(out)
