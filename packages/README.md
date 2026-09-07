# WorkPhelo Shared Packages

The `packages/` workspace contains small TypeScript packages shared by apps.

| Package               | Purpose                                                                  |
| --------------------- | ------------------------------------------------------------------------ |
| `@work-phelo/config`  | Cross-service configuration helpers such as Swagger enablement rules.    |
| `@work-phelo/schemas` | Shared schema definitions when a contract is intentionally cross-module. |
| `@work-phelo/types`   | Shared TypeScript types.                                                 |
| `@work-phelo/utils`   | Shared utility functions.                                                |

Keep package APIs generic. Domain-specific business rules should stay in the
owning app unless multiple modules genuinely share the same concept.

## Validation

```bash
npm run build --workspace=@work-phelo/config
npm run check-types --workspace=@work-phelo/types
npm run lint --workspace=@work-phelo/utils
```

The root `npm run check-types` and `npm run build` commands include all shared
packages.
