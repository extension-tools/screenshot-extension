self.PdfExporter = class PdfExporter {
  constructor({jpegQuality = 0.92} = {}) {
    this.jpegQuality = jpegQuality;
  }

  // PDF v1 consumes materialized capture output only.
  async export({result}) {
    if (result?.mode === 'single-canvas') {
      return this.exportSingleCanvas(result);
    }

    if (result?.mode === 'tiled-output') {
      return this.exportTiledOutput(result);
    }

    throw new Error('Unsupported capture result mode for PDF export.');
  }

  async exportSingleCanvas(result) {
    if (!result?.blob) {
      throw new Error('Single-canvas capture result is missing blob.');
    }

    const page = await this.toPdfPageImage(result.blob);
    const blob = this.createPdfBlob([page]);

    return {
      blob,
      summary: {
        pageCount: 1,
        source: 'single-bitmap',
        pageMode: 'single-page'
      }
    };
  }

  async exportTiledOutput(result) {
    if (!Array.isArray(result?.files) || !result.files.length) {
      throw new Error('Tiled capture result is missing files.');
    }

    const files = [...result.files].sort((left, right) => left.index - right.index);
    const pages = [];

    for (const file of files) {
      if (!file?.blob) {
        throw new Error('Tiled capture file is missing blob.');
      }

      pages.push(await this.toPdfPageImage(file.blob));
    }

    const blob = this.createPdfBlob(pages);

    return {
      blob,
      summary: {
        pageCount: pages.length,
        source: 'tiles',
        pageMode: 'multi-page'
      }
    };
  }

  async toPdfPageImage(sourceBlob) {
    const bitmap = await createImageBitmap(sourceBlob);

    try {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not create PDF export canvas context.');
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0);

      const jpegBlob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: this.jpegQuality
      });

      return {
        width: bitmap.width,
        height: bitmap.height,
        bytes: new Uint8Array(await jpegBlob.arrayBuffer())
      };
    } finally {
      if (typeof bitmap.close === 'function') {
        bitmap.close();
      }
    }
  }

  createPdfBlob(pages) {
    return new Blob([this.buildPdfBytes(pages)], {type: 'application/pdf'});
  }

  // Keep the PDF builder local in v1 to avoid adding a new dependency.
  buildPdfBytes(pages) {
    const objects = new Map();
    const pageObjectIds = [];
    let nextObjectId = 3;

    for (const [index, page] of pages.entries()) {
      const pageWidth = Math.max(1, Math.round(page.width));
      const pageHeight = Math.max(1, Math.round(page.height));
      const pageObjectId = nextObjectId++;
      const imageObjectId = nextObjectId++;
      const contentObjectId = nextObjectId++;
      const imageName = `Im${index + 1}`;
      const contentBytes = this.encodeText(
        `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/${imageName} Do\nQ`
      );

      objects.set(imageObjectId, [
        this.encodeText(
          `${imageObjectId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pageWidth} /Height ${pageHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.bytes.length} >>\nstream\n`
        ),
        page.bytes,
        this.encodeText('\nendstream\nendobj\n')
      ]);

      objects.set(contentObjectId, [
        this.encodeText(`${contentObjectId} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`),
        contentBytes,
        this.encodeText('\nendstream\nendobj\n')
      ]);

      objects.set(pageObjectId, [
        this.encodeText(
          `${pageObjectId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /${imageName} ${imageObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>\nendobj\n`
        )
      ]);

      pageObjectIds.push(pageObjectId);
    }

    objects.set(1, [
      this.encodeText('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
    ]);

    objects.set(2, [
      this.encodeText(
        `2 0 obj\n<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds.map(id => `${id} 0 R`).join(' ')}] >>\nendobj\n`
      )
    ]);

    const objectCount = nextObjectId - 1;
    const offsets = new Array(objectCount + 1).fill(0);
    const parts = [];
    let currentOffset = 0;

    this.appendPdfPart(parts, this.encodeText('%PDF-1.4\n'), value => { currentOffset += value; });

    for (let objectId = 1; objectId <= objectCount; objectId += 1) {
      offsets[objectId] = currentOffset;
      for (const part of objects.get(objectId) || []) {
        this.appendPdfPart(parts, part, value => { currentOffset += value; });
      }
    }

    const xrefOffset = currentOffset;
    this.appendPdfPart(parts, this.encodeText(`xref\n0 ${objectCount + 1}\n`), value => { currentOffset += value; });
    this.appendPdfPart(parts, this.encodeText('0000000000 65535 f \n'), value => { currentOffset += value; });

    for (let objectId = 1; objectId <= objectCount; objectId += 1) {
      const offset = String(offsets[objectId]).padStart(10, '0');
      this.appendPdfPart(parts, this.encodeText(`${offset} 00000 n \n`), value => { currentOffset += value; });
    }

    this.appendPdfPart(parts, this.encodeText(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`), value => { currentOffset += value; });

    return this.concatParts(parts, currentOffset);
  }

  appendPdfPart(parts, part, advanceOffset) {
    const normalizedPart = typeof part === 'string' ? this.encodeText(part) : part;
    parts.push(normalizedPart);
    advanceOffset(normalizedPart.length);
  }

  concatParts(parts, totalLength) {
    const bytes = new Uint8Array(totalLength);
    let offset = 0;

    for (const part of parts) {
      bytes.set(part, offset);
      offset += part.length;
    }

    return bytes;
  }

  encodeText(value) {
    return new TextEncoder().encode(String(value));
  }
};
