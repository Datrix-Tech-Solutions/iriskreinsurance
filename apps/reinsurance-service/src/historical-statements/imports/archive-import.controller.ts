import {
  BadRequestException,
  CallHandler,
  Controller,
  ExecutionContext,
  Get,
  Header,
  HttpCode,
  HttpException,
  Injectable,
  NestInterceptor,
  Param,
  Post,
  Req,
  Body,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiOkResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { diskStorage } from 'multer';
import { Observable, finalize } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { HistoricalStatementsAccessGuard } from '../historical-statements-access.guard';
import { RequirePermissions } from '../../auth/decorators/permissions.decorator';
import { HistoricalStatementsPermission } from '../historical-statements.permissions';
import { ArchiveImportService, ImportIdentity } from './archive-import.service';
import {
  ArchiveImportParamsDto,
  ArchiveImportResponseDto,
  ArchivePublishDto,
  ArchiveUploadDto,
} from './archive-import.dto';
import {
  incomingDirectory,
  removeIncoming,
  UPLOAD_LIMITS,
} from './archive-import.storage';

type ImportRequest = Request & {
  user: RequestUser;
  files?: Express.Multer.File[];
};
@Injectable()
export class ArchiveIncomingCleanupInterceptor implements NestInterceptor {
  private readonly receiving = new Set<string>();
  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const req = context.switchToHttp().getRequest<ImportRequest>();
    if (this.receiving.size >= 2 || this.receiving.has(req.user.tenantId))
      throw new HttpException('ARCHIVE_UPLOAD_BUSY', 429);
    await incomingDirectory();
    this.receiving.add(req.user.tenantId);
    return next.handle().pipe(
      finalize(() => {
        this.receiving.delete(req.user.tenantId);
        void removeIncoming(req.files ?? []).catch(() => undefined);
      }),
    );
  }
}
const upload = FilesInterceptor('files', 10, {
  limits: UPLOAD_LIMITS,
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      void incomingDirectory().then(
        (path) => cb(null, path),
        () => cb(new Error('ARCHIVE_PRIVATE_STORAGE_REQUIRED'), ''),
      );
    },
    filename: (_req, _file, cb) => cb(null, randomUUID()),
  }),
  fileFilter: (_req, file, cb) => {
    if (!file.originalname.toLowerCase().endsWith('.xlsx'))
      return cb(new BadRequestException('ARCHIVE_XLSX_REQUIRED'), false);
    cb(null, true);
  },
});
@Controller('historical-statements/imports')
@ApiTags('Reinsurance - Historical Statement Imports')
@ApiBearerAuth('access-token')
@ApiCookieAuth('access_token')
@UseGuards(JwtAuthGuard, HistoricalStatementsAccessGuard)
@RequirePermissions(HistoricalStatementsPermission.IMPORT)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class ArchiveImportController {
  constructor(private readonly imports: ArchiveImportService) {}
  private identity(req: ImportRequest): ImportIdentity {
    const token =
      (req.cookies as Record<string, string> | undefined)?.access_token ||
      req.headers.authorization?.replace('Bearer ', '');
    if (!token) throw new BadRequestException('ARCHIVE_SESSION_REQUIRED');
    return {
      actor: {
        tenantId: req.user.tenantId,
        userId: req.user.id,
        tenantSlug: req.user.tenantSlug,
      },
      token,
    };
  }
  @Post()
  @Header('Cache-Control', 'private,no-store')
  @Header('Vary', 'Cookie,Authorization')
  @HttpCode(202)
  @UseInterceptors(ArchiveIncomingCleanupInterceptor, upload)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['files', 'metadata'],
      properties: {
        files: {
          type: 'array',
          minItems: 10,
          maxItems: 10,
          items: { type: 'string', format: 'binary' },
        },
        metadata: {
          type: 'string',
          example: '[{"index":0,"kind":"INSURER","year":2021}]',
        },
      },
    },
  })
  @ApiAcceptedResponse({ type: ArchiveImportResponseDto })
  @ApiOperation({
    summary:
      'Privately retain and validate ten workbooks; stage without publication',
    description:
      '202 queues bounded validation/staging. Tenant and actor come only from the current session. All rows are unlinked. Requires configured dedicated archive roles and private durable storage.',
  })
  upload(
    @Req() req: ImportRequest,
    @Body() dto: ArchiveUploadDto,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.imports.submit(this.identity(req), dto.metadata, files ?? []);
  }
  @Header('Cache-Control', 'private,no-store')
  @Header('Vary', 'Cookie,Authorization')
  @Get(':id')
  @ApiOkResponse({ type: ArchiveImportResponseDto })
  @ApiOperation({
    summary: 'Get this tenant’s validation, staging and publication status',
  })
  status(@Req() req: ImportRequest, @Param() p: ArchiveImportParamsDto) {
    return this.imports.status(this.identity(req), p.id);
  }
  @Header('Cache-Control', 'private,no-store')
  @Header('Vary', 'Cookie,Authorization')
  @Post(':id/publish')
  @HttpCode(202)
  @ApiAcceptedResponse({ type: ArchiveImportResponseDto })
  @ApiOperation({
    summary:
      'Explicitly publish the exact validated version, approving all-unlinked association',
    description:
      'Requires a real approval reference. Replacing a published dataset requires its exact UUID. Publication runs asynchronously through the existing atomic lifecycle.',
  })
  publish(
    @Req() req: ImportRequest,
    @Param() p: ArchiveImportParamsDto,
    @Body() dto: ArchivePublishDto,
  ) {
    return this.imports.publish(this.identity(req), p.id, dto);
  }
}
