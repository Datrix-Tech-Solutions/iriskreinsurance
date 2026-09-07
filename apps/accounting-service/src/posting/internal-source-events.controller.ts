import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  AuthenticatedInternalRequest,
  INTERNAL_SERVICE_AUTH_HEADERS,
  InternalServiceAuthGuard,
} from '../auth/guards/internal-service-auth.guard';
import { InternalSourceEventDto } from './dto/posting.dto';
import { SourceEventsService } from './source-events.service';

@ApiTags('Internal Accounting Source Events')
@Controller('internal/source-events')
@UseGuards(InternalServiceAuthGuard)
export class InternalSourceEventsController {
  constructor(private readonly sourceEvents: SourceEventsService) {}

  @Post()
  @ApiOperation({
    summary: 'Enqueue an authenticated operational accounting event',
    description:
      'Validates the configured Accounting tenant and stores the event as RECEIVED. Posting is asynchronous and remains the responsibility of the Accounting posting engine.',
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
      'Hex HMAC-SHA256 of service:timestamp:POST:/internal/source-events.',
  })
  @ApiCreatedResponse({
    description:
      'The RECEIVED event, or the existing tenant event for a duplicate idempotency key.',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid service credentials.' })
  @ApiNotFoundResponse({
    description: 'Accounting is not configured for the supplied tenant.',
  })
  enqueue(
    @Req() request: AuthenticatedInternalRequest,
    @Body() dto: InternalSourceEventDto,
  ) {
    return this.sourceEvents.enqueueInternal(request.internalServiceName, dto);
  }
}
