import { createHash } from 'crypto';
import { readFile } from 'fs/promises';
import { LegacyOffer } from './legacy-import.types';

export type LegacyOfferFile = {
  sourceFilePath: string;
  sourceFileHash: string;
  offers: LegacyOffer[];
};

export class LegacyOffersReader {
  async read(sourceFilePath: string): Promise<LegacyOfferFile> {
    const body = await readFile(sourceFilePath, 'utf8');
    const parsed = JSON.parse(body) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('Legacy offers source must be a JSON array.');
    }
    return {
      sourceFilePath,
      sourceFileHash: createHash('sha256').update(body).digest('hex'),
      offers: parsed as LegacyOffer[],
    };
  }
}
