import { Module } from '@nestjs/common';
import { InternalServiceAuthGuard } from './guards/internal-service-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ModuleGuard } from './guards/module.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  providers: [
    InternalServiceAuthGuard,
    JwtAuthGuard,
    ModuleGuard,
    PermissionsGuard,
  ],
  exports: [
    InternalServiceAuthGuard,
    JwtAuthGuard,
    ModuleGuard,
    PermissionsGuard,
  ],
})
export class AuthModule {}
