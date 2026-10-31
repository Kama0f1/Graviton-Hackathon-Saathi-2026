# One wrapper: image(s) + prompt + Pydantic schema -> validated model.
# Uses Gemini structured output (response_schema), temperature 0.
# TODO: def ask(images: list[bytes], prompt: str, schema: type[BaseModel], model: str = GEMINI_MODEL) -> BaseModel
