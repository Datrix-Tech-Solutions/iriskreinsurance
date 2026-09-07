import { SetMetadata } from '@nestjs/common';
import { MODULE_KEY } from '../guards/module.guard';

export const RequireModule = (module: string) =>
  SetMetadata(MODULE_KEY, module);
