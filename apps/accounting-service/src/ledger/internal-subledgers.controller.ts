import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AuthenticatedInternalRequest,
  INTERNAL_SERVICE_AUTH_HEADERS,
  InternalServiceAuthGuard,
} from '../auth/guards/internal-service-auth.guard';
import { AccountingMasterDataService } from './accounting-master-data.service';
import { EnsureInternalSubledgerDto } from './dto/accounting.dto';

@ApiTags('Internal Accounting Subledgers')
@Controller('internal/subledgers')
@UseGuards(InternalServiceAuthGuard)
export class InternalSubledgersController {
  constructor(private readonly masterData: AccountingMasterDataService) {}

  @Post('ensure')
  @ApiOperation({
    summary: 'Ensure an insurance-specific subledger for a trusted service',
    description:
      'Idempotently creates or refreshes a tenant CEDANT/REINSURER subledger using Accounting-owned control accounts. This does not create journals.',
  })
  @ApiHeader({
    name: INTERNAL_SERVICE_AUTH_HEADERS.service,
    required: true,
    description:
      'Calling service name from INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES.',
  })
  @ApiHeader({
    name: INTERNAL_SERVICE_AUTH_HEADERS.timestamp,
    required: true,
    description: 'Current Unix timestamp in seconds.',
  })
  @ApiHeader({
    name: INTERNAL_SERVICE_AUTH_HEADERS.signature,
    required: true,
    description:
      'Hex HMAC-SHA256 of service:timestamp:POST:/internal/subledgers/ensure.',
  })
  @ApiCreatedResponse({
    description:
      'The active Accounting subledger linked by tenant, type and externalRef.',
  })
  @ApiBadRequestResponse({
    description:
      'Accounting configuration, control account or payload is incomplete.',
  })
  @ApiConflictResponse({
    description:
      'An inactive or incompatible existing subledger requires Accounting review.',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid service credentials.' })
  ensure(
    @Req() request: AuthenticatedInternalRequest,
    @Body() dto: EnsureInternalSubledgerDto,
  ) {
    return this.masterData.ensureInternalInsuranceSubledger(
      request.internalServiceName,
      dto,
    );
  }
}
