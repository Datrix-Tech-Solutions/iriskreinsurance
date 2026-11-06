import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  HistoricalStatementsAccessQueryDto,
  HistoricalStatementsEntitlementDto,
} from './dto/historical-statements-entitlement.dto';
import { HistoricalStatementsEntitlementService } from './historical-statements-entitlement.service';
import { HistoricalStatementsJwtGuard } from './historical-statements-jwt.guard';

@Controller('tenants')
@UseGuards(HistoricalStatementsJwtGuard)
export class HistoricalStatementsEntitlementController {
  constructor(
    private readonly service: HistoricalStatementsEntitlementService,
  ) {}

  @Get('me/historical-statements-access')
  @Header('Cache-Control', 'private,no-store')
  @Header('Vary', 'Cookie,Authorization')
  access(
    @Req() req: { user: RequestUser },
    @Query(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    _query: HistoricalStatementsAccessQueryDto,
  ) {
    return this.service.getAccess(req.user);
  }

  @Patch(':id/historical-statements-entitlement')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    )
    dto: HistoricalStatementsEntitlementDto,
    @Req() req: { user: RequestUser },
  ) {
    return this.service.update(id, dto, req.user);
  }
}
