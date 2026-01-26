---
name: PDF Rotation Tool
description: This skill should be used when the user asks to "rotate PDF", "turn PDF pages", "flip PDF orientation", or mentions PDF rotation. Provides quick PDF rotation utility without external dependencies.
version: 1.0.0
---

# PDF Rotation Tool

## Purpose

Rotate PDF pages by 90, 180, or 270 degrees using built-in Python libraries. No external PDF libraries required - uses PyPDF2 which is included in most Python environments.

## When to Use

Use this skill when:
- Rotating individual PDF pages
- Fixing PDF orientation (portrait/landscape)
- Batch rotating all pages in a PDF
- Need quick rotation without installing dependencies

## How to Rotate PDFs

### Basic Rotation

To rotate a PDF:
1. Import the PyPDF2 library
2. Open the PDF file in read-binary mode
3. Create PDF reader and writer objects
4. Rotate each page by the desired angle
5. Write the output to a new file

### Rotation Angles

**Supported rotations:**
- 90° clockwise: Use `rotate(90)` or `rotate(-270)`
- 180°: Use `rotate(180)` or `rotate(-180)`
- 270° clockwise: Use `rotate(270)` or `rotate(-90)`

**Note:** PyPDF2 uses clockwise rotation by default.

### Code Pattern

```python
from PyPDF2 import PdfReader, PdfWriter

def rotate_pdf(input_path, output_path, degrees):
    reader = PdfReader(input_path)
    writer = PdfWriter()

    for page in reader.pages:
        page.rotate(degrees)
        writer.add_page(page)

    with open(output_path, 'wb') as output_file:
        writer.write(output_file)

# Usage
rotate_pdf('input.pdf', 'output.pdf', 90)
```

## Common Scenarios

**Rotate single page:**
```python
reader = PdfReader('input.pdf')
writer = PdfWriter()

# Rotate only page 3 by 90 degrees
for i, page in enumerate(reader.pages):
    if i == 2:  # Page 3 (0-indexed)
        page.rotate(90)
    writer.add_page(page)
```

**Rotate even/odd pages:**
```python
for i, page in enumerate(reader.pages):
    if i % 2 == 0:  # Even pages (0, 2, 4...)
        page.rotate(90)
    writer.add_page(page)
```

## Error Handling

**Check file exists:**
```python
import os
if not os.path.exists(input_path):
    raise FileNotFoundError(f"PDF not found: {input_path}")
```

**Validate rotation angle:**
```python
if degrees not in [90, 180, 270, -90, -180, -270]:
    raise ValueError("Rotation must be 90, 180, or 270 degrees")
```

**Handle corrupted PDFs:**
```python
try:
    reader = PdfReader(input_path)
except Exception as e:
    raise ValueError(f"Invalid PDF file: {e}")
```

## Summary

PDF rotation is straightforward with PyPDF2. Import the library, create reader/writer objects, rotate pages using the `rotate()` method, and write to output. Validate inputs and handle errors for production use.
