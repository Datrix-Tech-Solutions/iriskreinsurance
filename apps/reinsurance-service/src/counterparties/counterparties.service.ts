import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  RequestUser,
  ReinsuranceCounterpartyAuditEvent,
} from '@work-phelo/types';
import { CounterpartyOrigin, Prisma } from '../../prisma/generated/client';
import { CounterpartyEventPublisher } from '../messaging/counterparty-event.publisher';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCounterpartyAddressDto } from './dto/create-counterparty-address.dto';
import { CreateCounterpartyContactDto } from './dto/create-counterparty-contact.dto';
import { CreateCounterpartyDto } from './dto/create-counterparty.dto';
import { QueryCounterpartiesDto } from './dto/query-counterparties.dto';
import { UpdateCounterpartyDto } from './dto/update-counterparty.dto';

const counterpartyInclude = {
  contacts: {
    orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }],
  },
  addresses: {
    orderBy: [{ isPrimary: 'desc' }, { city: 'asc' }],
  },
} satisfies Prisma.CounterpartyInclude;

type CounterpartyRecord = Prisma.CounterpartyGetPayload<{
  include: typeof counterpartyInclude;
}>;

@Injectable()
export class CounterpartiesService {
  private readonly logger = new Logger(CounterpartiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: CounterpartyEventPublisher,
  ) {}

  async findAll(tenantId: string, query: QueryCounterpartiesDto) {
    const search = query.search?.trim();
    const where: Prisma.CounterpartyWhereInput = {
      tenantId,
      archivedAt: null,
      ...(query.type ? { type: query.type } : {}),
      ...(query.origin ? { origin: query.origin } : {}),
      ...(query.country ? { country: query.country } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              {
                registrationNumber: {
                  contains: search,
                  mode: 'insensitive',
                },
              },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (query.page - 1) * query.limit;

    const [items, total] = await Promise.all([
      this.prisma.counterparty.findMany({
        where,
        include: counterpartyInclude,
        orderBy: { name: 'asc' },
        skip,
        take: query.limit,
      }),
      this.prisma.counterparty.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async findOne(tenantId: string, id: string): Promise<CounterpartyRecord> {
    const counterparty = await this.prisma.counterparty.findFirst({
      where: { id, tenantId, archivedAt: null },
      include: counterpartyInclude,
    });

    if (!counterparty) {
      throw new NotFoundException('Counterparty not found');
    }

    return counterparty;
  }

  async create(
    user: RequestUser,
    dto: CreateCounterpartyDto,
  ): Promise<CounterpartyRecord> {
    this.validateChildren(dto.contacts, dto.addresses);
    const name = this.requiredText(dto.name);
    const origin = dto.origin ?? CounterpartyOrigin.LOCAL;
    const country = this.optionalCountry(dto.country);
    this.validateOriginDetails(origin, country);

    try {
      const created = await this.prisma.counterparty.create({
        data: {
          tenantId: user.tenantId,
          type: dto.type,
          origin,
          name,
          normalizedName: this.normalizeName(name),
          registrationNumber: this.optionalText(dto.registrationNumber),
          country,
          taxId: this.optionalText(dto.taxId),
          licenseNumber: this.optionalText(dto.licenseNumber),
          email: this.optionalText(dto.email),
          phone: this.optionalText(dto.phone),
          website: this.optionalText(dto.website),
          notes: this.optionalText(dto.notes),
          brokerageFee: dto.brokerageFee ?? null,
          createdByUserId: user.id,
          updatedByUserId: user.id,
          contacts: dto.contacts
            ? { create: this.mapContacts(dto.contacts) }
            : undefined,
          addresses: dto.addresses
            ? { create: this.mapAddresses(dto.addresses) }
            : undefined,
        },
        include: counterpartyInclude,
      });

      this.publish(
        () =>
          this.publisher.created(
            this.auditEvent(created, user, {
              after: this.auditSnapshot(created),
            }),
          ),
        'create',
        created.id,
      );
      return created;
    } catch (error) {
      this.rethrowWriteError(error);
      throw error;
    }
  }

  async update(
    user: RequestUser,
    id: string,
    dto: UpdateCounterpartyDto,
  ): Promise<CounterpartyRecord> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }

    this.validateChildren(dto.contacts, dto.addresses);
    const existing = await this.findOne(user.tenantId, id);
    const nextOrigin = dto.origin ?? existing.origin;
    const nextCountry =
      dto.country !== undefined
        ? this.optionalCountry(dto.country)
        : existing.country;
    this.validateOriginDetails(nextOrigin, nextCountry);

    const data: Prisma.CounterpartyUpdateInput = {
      updatedByUserId: user.id,
    };

    if (dto.type !== undefined) data.type = dto.type;
    if (dto.origin !== undefined) data.origin = dto.origin;
    if (dto.name !== undefined) {
      data.name = this.requiredText(dto.name);
      data.normalizedName = this.normalizeName(data.name);
    }
    if (dto.registrationNumber !== undefined) {
      data.registrationNumber = this.optionalText(dto.registrationNumber);
    }
    if (dto.country !== undefined) {
      data.country = this.optionalCountry(dto.country);
    }
    if (dto.taxId !== undefined) data.taxId = this.optionalText(dto.taxId);
    if (dto.licenseNumber !== undefined) {
      data.licenseNumber = this.optionalText(dto.licenseNumber);
    }
    if (dto.email !== undefined) data.email = this.optionalText(dto.email);
    if (dto.phone !== undefined) data.phone = this.optionalText(dto.phone);
    if (dto.website !== undefined) {
      data.website = this.optionalText(dto.website);
    }
    if (dto.notes !== undefined) data.notes = this.optionalText(dto.notes);
    if (dto.brokerageFee !== undefined)
      data.brokerageFee = dto.brokerageFee ?? null;
    if (dto.contacts !== undefined) {
      data.contacts = {
        deleteMany: {},
        create: this.mapContacts(dto.contacts),
      };
    }
    if (dto.addresses !== undefined) {
      data.addresses = {
        deleteMany: {},
        create: this.mapAddresses(dto.addresses),
      };
    }

    try {
      const updated = await this.prisma.counterparty.update({
        where: {
          id_tenantId: { id, tenantId: user.tenantId },
          archivedAt: null,
        },
        data,
        include: counterpartyInclude,
      });

      this.publish(
        () =>
          this.publisher.updated(
            this.auditEvent(updated, user, {
              before: this.auditSnapshot(existing),
              after: this.auditSnapshot(updated),
            }),
          ),
        'update',
        updated.id,
      );
      return updated;
    } catch (error) {
      this.rethrowWriteError(error);
      throw error;
    }
  }

  async archive(user: RequestUser, id: string): Promise<CounterpartyRecord> {
    const existing = await this.findOne(user.tenantId, id);
    let archived: CounterpartyRecord;
    try {
      archived = await this.prisma.counterparty.update({
        where: {
          id_tenantId: { id, tenantId: user.tenantId },
          archivedAt: null,
        },
        data: {
          archivedAt: new Date(),
          archivedByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: counterpartyInclude,
      });
    } catch (error) {
      this.rethrowWriteError(error);
      throw error;
    }

    this.publish(
      () =>
        this.publisher.deleted(
          this.auditEvent(archived, user, {
            before: this.auditSnapshot(existing),
            after: this.auditSnapshot(archived),
          }),
        ),
      'archive',
      archived.id,
    );
    return archived;
  }

  private validateChildren(
    contacts?: CreateCounterpartyContactDto[],
    addresses?: CreateCounterpartyAddressDto[],
  ): void {
    if ((contacts?.filter((contact) => contact.isPrimary).length ?? 0) > 1) {
      throw new BadRequestException(
        'Only one primary counterparty contact is permitted',
      );
    }
    if (
      contacts?.some(
        (contact) =>
          !this.optionalText(contact.email) &&
          !this.optionalText(contact.phone),
      )
    ) {
      throw new BadRequestException(
        'Each counterparty contact must have an email or phone number',
      );
    }
    if ((addresses?.filter((address) => address.isPrimary).length ?? 0) > 1) {
      throw new BadRequestException(
        'Only one primary counterparty address is permitted',
      );
    }
  }

  // The nested relation inherits both parent keys, including tenantId.
  private mapContacts(contacts: CreateCounterpartyContactDto[]) {
    return contacts.map((contact) => ({
      fullName: this.requiredText(contact.fullName),
      jobTitle: this.optionalText(contact.jobTitle),
      email: this.optionalText(contact.email),
      phone: this.optionalText(contact.phone),
      isPrimary: contact.isPrimary ?? false,
    }));
  }

  private mapAddresses(addresses: CreateCounterpartyAddressDto[]) {
    return addresses.map((address) => ({
      label: this.optionalText(address.label),
      line1: this.requiredText(address.line1),
      line2: this.optionalText(address.line2),
      city: this.requiredText(address.city),
      state: this.optionalText(address.state),
      postalCode: this.optionalText(address.postalCode),
      country: this.requiredText(address.country).toUpperCase(),
      isPrimary: address.isPrimary ?? false,
    }));
  }

  private auditEvent(
    counterparty: CounterpartyRecord,
    user: RequestUser,
    changes: ReinsuranceCounterpartyAuditEvent['changes'],
  ): ReinsuranceCounterpartyAuditEvent {
    return {
      tenantId: user.tenantId,
      counterpartyId: counterparty.id,
      counterpartyType: counterparty.type,
      counterpartyName: counterparty.name,
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      changes,
    };
  }

  private auditSnapshot(counterparty: CounterpartyRecord) {
    return {
      type: counterparty.type,
      origin: counterparty.origin,
      name: counterparty.name,
      registrationNumber: counterparty.registrationNumber,
      country: counterparty.country,
      taxId: counterparty.taxId,
      licenseNumber: counterparty.licenseNumber,
      archivedAt: counterparty.archivedAt?.toISOString() ?? null,
      contactCount: counterparty.contacts.length,
      addressCount: counterparty.addresses.length,
    };
  }

  private requiredText(value: string): string {
    return value.trim();
  }

  private optionalText(value?: string): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private optionalCountry(value?: string): string | null {
    const normalized = this.optionalText(value);
    if (!normalized) {
      return null;
    }

    const country = normalized.toUpperCase();
    if (country.length !== 2) {
      throw new BadRequestException(
        'country must be a 2-character ISO 3166-1 alpha-2 code',
      );
    }
    return country;
  }

  private validateOriginDetails(
    origin: CounterpartyOrigin,
    country: string | null,
  ): void {
    if (origin === CounterpartyOrigin.FOREIGN && !country) {
      throw new BadRequestException(
        'country is required for FOREIGN counterparties',
      );
    }
  }

  private normalizeName(name: string): string {
    return name.toLowerCase();
  }

  private rethrowWriteError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'An active counterparty with this name and type already exists',
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new NotFoundException('Counterparty not found');
    }
  }

  private publish(
    publishEvent: () => Promise<void>,
    operation: string,
    counterpartyId: string,
  ): void {
    try {
      void publishEvent().catch((error: unknown) => {
        this.logPublishFailure(operation, counterpartyId, error);
      });
    } catch (error) {
      this.logPublishFailure(operation, counterpartyId, error);
    }
  }

  private logPublishFailure(
    operation: string,
    counterpartyId: string,
    error: unknown,
  ): void {
    const reason = error instanceof Error ? error.message : String(error);
    this.logger.warn(
      `Counterparty ${operation} audit event failed for ${counterpartyId}: ${reason}`,
    );
  }
}
