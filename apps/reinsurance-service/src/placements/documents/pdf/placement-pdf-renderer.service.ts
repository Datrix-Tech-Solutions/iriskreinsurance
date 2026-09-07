import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright-core';
import {
  PlacementDocumentStatus,
  PlacementDocumentType,
  Prisma,
} from '../../../../prisma/generated/client';
import { PlacementDocumentTemplateRegistry } from './placement-document-template.registry';

type PdfDocument = {
  documentNumber: string;
  title: string;
  type: PlacementDocumentType;
  status: PlacementDocumentStatus;
  renderPayload: Prisma.JsonValue;
  generatedAt: Date | string | null;
};

@Injectable()
export class PlacementPdfRendererService {
  private readonly logger = new Logger(PlacementPdfRendererService.name);

  constructor(
    private readonly templateRegistry: PlacementDocumentTemplateRegistry,
  ) {}

  async render(document: PdfDocument): Promise<Buffer> {
    const html = this.templateRegistry.renderHtml(
      document.type,
      document.renderPayload,
      {
        documentNumber: document.documentNumber,
        title: document.title,
        generatedAt: document.generatedAt,
      },
    );

    const executablePath = this.chromiumExecutablePath();
    const browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });
      return await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm',
        },
      });
    } catch (error) {
      this.logger.error(
        'Failed to render placement PDF',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    } finally {
      await browser.close();
    }
  }

  private chromiumExecutablePath(): string | undefined {
    const configured = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
    if (configured?.trim()) return configured.trim();
    return undefined;
  }
}
