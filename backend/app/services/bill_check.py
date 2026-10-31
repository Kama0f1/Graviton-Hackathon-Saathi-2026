# NEVER trust the LLM's maths. Python sums the items and compares with the printed total.
from ..schemas import Bill

TOLERANCE = 1.0  # rupees, for rounding


def check(bill: Bill) -> Bill:
    bill.computed_total = round(sum(i.amount for i in bill.items), 2)
    if bill.printed_total is not None:
        bill.mismatch = abs(bill.computed_total - bill.printed_total) > TOLERANCE
    return bill


def warning_sentence(bill: Bill) -> str:
    if not bill.mismatch or bill.printed_total is None:
        return ""
    return (f"Warning: the items add up to {bill.computed_total:,.0f} rupees, "
            f"but the total says {bill.printed_total:,.0f}.")
