import { Module } from '@nestjs/common';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ModuleGuard } from './guards/module.guard';
import { FeatureGuard } from './guards/feature.guard';
import { PermissionsGuard } from './guards/permissions.guard';

@Module({
  providers: [JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard],
  exports: [JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard],
})
export class AuthModule {}
