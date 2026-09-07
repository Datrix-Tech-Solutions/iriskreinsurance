import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AuthenticatedInternalRequest,
  INTERNAL_SERVICE_AUTH_HEADERS,
  InternalServiceAuthGuard,
} from '../auth/guards/internal-service-auth.guard';
import {
  InternalReinsuranceAccountingReadinessDto,
  ReinsuranceAccountingReadinessResponseDto,
} from './dto/posting.dto';
import { AccountingReadinessService } from './accounting-readiness.service';

@ApiTags('Internal Reinsurance Accounting Readiness')
@Controller('internal/reinsurance/accounting-readiness')
@UseGuards(InternalServiceAuthGuard)
export class InternalReinsuranceAccountingReadinessController {
  constructor(private readonly readiness: AccountingReadinessService) {}

  @Post()
  @ApiOperation({
    summary: 'Validate Reinsurance Accounting posting readiness',
    description:
      'Internal, tenant-scoped preflight used before Reinsurance accepts financially recognizable business boundaries. It validates PostingRules, control-account/subledger shape, event currency, fiscal period and cash-account readiness without exposing SQL, source payloads, HMAC material or secrets.',
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
      'Hex HMAC-SHA256 of service:timestamp:POST:/internal/reinsurance/accounting-readiness.',
  })
  @ApiOkResponse({ type: ReinsuranceAccountingReadinessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid service credentials.' })
  check(
    @Req() _request: AuthenticatedInternalRequest,
    @Body() dto: InternalReinsuranceAccountingReadinessDto,
  ) {
    return this.readiness.checkReinsuranceReadiness(dto);
  }
}
