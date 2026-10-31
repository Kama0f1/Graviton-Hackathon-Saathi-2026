"""Thinking is switched off per model, with fallbacks for models that reject a setting,
and a failed Read model falls back to the fast default model."""
import asyncio
from types import SimpleNamespace

from app.schemas import SpeechOnly
from app.services import gemini


class FakeModels:
    def __init__(self, reject_budget=False, fail_models=()):
        self.calls = []
        self.reject_budget = reject_budget
        self.fail_models = set(fail_models)

    async def generate_content(self, model, contents, config):
        tc = config.thinking_config
        self.calls.append((model, None if tc is None else (tc.thinking_budget, tc.thinking_level)))
        if model in self.fail_models:
            raise RuntimeError("503 UNAVAILABLE")
        if self.reject_budget and tc is not None and tc.thinking_budget == 0:
            raise RuntimeError("400 INVALID_ARGUMENT: thinking_budget is not supported by this model")
        return SimpleNamespace(parsed=SpeechOnly(speech=f"from {model}"), text="")


def use(monkeypatch, models):
    monkeypatch.setattr(gemini, "_get_client", lambda: SimpleNamespace(aio=SimpleNamespace(models=models)))
    monkeypatch.setattr(gemini, "_thinking_choice", {})


def test_thinking_off_first_try(monkeypatch):
    m = FakeModels(); use(monkeypatch, m)
    r = asyncio.run(gemini.ask("p", SpeechOnly, model="m1", fallback=False))
    assert r.speech == "from m1" and m.calls == [("m1", (0, None))]


def test_rejected_budget_moves_on_and_is_remembered(monkeypatch):
    m = FakeModels(reject_budget=True); use(monkeypatch, m)
    asyncio.run(gemini.ask("p", SpeechOnly, model="m2", fallback=False))
    assert [c[1][0] if c[1] else None for c in m.calls] == [0, None]  # budget=0 rejected, then level=minimal
    m.calls.clear()
    asyncio.run(gemini.ask("p", SpeechOnly, model="m2", fallback=False))
    assert len(m.calls) == 1  # remembered: no wasted call the second time


def test_read_model_falls_back_to_fast_model(monkeypatch):
    m = FakeModels(fail_models={"flash"}); use(monkeypatch, m)
    r = asyncio.run(gemini.ask("p", SpeechOnly, model="flash"))
    assert r.speech == f"from {gemini.GEMINI_MODEL}"
