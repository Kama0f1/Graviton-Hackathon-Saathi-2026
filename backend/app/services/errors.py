class BadInput(Exception):
    """The request itself is wrong (empty file, wrong type, too large). -> HTTP 400"""


class AIError(Exception):
    """An external AI service failed or is not configured. -> HTTP 503"""
