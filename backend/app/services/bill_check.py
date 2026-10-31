"""NEVER trust the AI's maths. Python sums the items and compares with the printed total."""
from ..schemas import Bill

TOLERANCE = 1.0  # rupees, allows for rounding on the bill


def check(bill: Bill) -> Bill:
    bill.computed_total = round(sum(item.amount for item in bill.items), 2)
    bill.mismatch = (
        bill.printed_total is not None
        and abs(bill.computed_total - bill.printed_total) > TOLERANCE
    )
    return bill
