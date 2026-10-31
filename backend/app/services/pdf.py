"""Not used: Gemini reads PDFs directly (mime application/pdf).
Fallback only if a PDF ever fails: render pages to images with PyMuPDF
(`pip install pymupdf`, then fitz.open(stream=data, filetype="pdf"))."""
