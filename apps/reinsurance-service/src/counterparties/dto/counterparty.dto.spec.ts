import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CounterpartyOrigin,
  CounterpartyType,
} from '../../../prisma/generated/client';
import { CreateCounterpartyDto } from './create-counterparty.dto';

describe('CreateCounterpartyDto', () => {
  it('rejects required text that becomes blank after normalization', async () => {
    const dto = plainToInstance(CreateCounterpartyDto, {
      type: CounterpartyType.CEDANT,
      name: '   ',
    });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'name',
        }),
      ]),
    );
  });

  it('normalizes nested contact and address strings before persistence', async () => {
    const dto = plainToInstance(CreateCounterpartyDto, {
      type: CounterpartyType.REINSURER,
      name: '  Ghana Re  ',
      contacts: [{ fullName: '  Ama Broker ', email: ' ama@example.com ' }],
      addresses: [
        { line1: '  1 High Street ', city: ' Accra ', country: ' gh ' },
      ],
    });

    expect(dto.name).toBe('Ghana Re');
    expect(dto.contacts?.[0]?.fullName).toBe('Ama Broker');
    expect(dto.contacts?.[0]?.email).toBe('ama@example.com');
    expect(dto.addresses?.[0]?.line1).toBe('1 High Street');
    expect(dto.addresses?.[0]?.city).toBe('Accra');
    expect(dto.addresses?.[0]?.country).toBe('GH');
    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('allows local counterparties without country', async () => {
    const dto = plainToInstance(CreateCounterpartyDto, {
      type: CounterpartyType.CEDANT,
      origin: CounterpartyOrigin.LOCAL,
      name: 'Local Cedant',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('requires country for foreign counterparties', async () => {
    const dto = plainToInstance(CreateCounterpartyDto, {
      type: CounterpartyType.REINSURER,
      origin: CounterpartyOrigin.FOREIGN,
      name: 'Foreign Re',
    });

    const errors = await validate(dto);

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'country',
        }),
      ]),
    );
  });

  it('normalizes foreign country codes to uppercase', async () => {
    const dto = plainToInstance(CreateCounterpartyDto, {
      type: CounterpartyType.REINSURER,
      origin: CounterpartyOrigin.FOREIGN,
      name: 'Foreign Re',
      country: ' ng ',
    });

    expect(dto.country).toBe('NG');
    await expect(validate(dto)).resolves.toEqual([]);
  });
});
