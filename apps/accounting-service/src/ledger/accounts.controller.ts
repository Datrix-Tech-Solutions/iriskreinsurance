import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { RequestUser } from '@work-phelo/types';
import { RequireModule } from '../auth/decorators/module.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModuleGuard } from '../auth/guards/module.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AccountingMasterDataService } from './accounting-master-data.service';
import { AccountingPermission } from './accounting.permissions';
import {
  CreateAccountClassificationDto,
  CreateAccountGroupDto,
  CreateAccountingCustomerDto,
  CreateAccountingVendorDto,
  CreateCostCentreDto,
  CreateGLAccountDto,
  CreateSubledgerAccountDto,
  QueryAccountingPartiesDto,
  QueryAccountGroupsDto,
  QueryAccountHierarchyDto,
  QueryGLAccountsDto,
  QuerySubledgerAccountsDto,
  UpdateAccountClassificationDto,
  UpdateAccountGroupDto,
  UpdateAccountingCustomerDto,
  UpdateAccountingVendorDto,
  UpdateCostCentreDto,
  UpdateGLAccountDto,
  UpdateSubledgerAccountDto,
} from './dto/accounting.dto';
import { JournalsService } from './journals.service';

@Controller()
@ApiCookieAuth('access_token')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, ModuleGuard, PermissionsGuard)
@RequireModule('accounting')
export class AccountsController {
  constructor(
    private readonly masterData: AccountingMasterDataService,
    private readonly journals: JournalsService,
  ) {}

  @Get('account-categories')
  @ApiTags('Accounting - Chart of Accounts')
  @ApiOperation({ summary: 'List system-controlled account categories' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_VIEW)
  listAccountCategories() {
    return this.masterData.listAccountCategories();
  }

  @Get('account-classifications')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'List tenant account classifications' })
  @RequirePermissions(AccountingPermission.ACCOUNT_CLASSIFICATIONS_VIEW)
  listAccountClassifications(
    @Query() query: QueryAccountHierarchyDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.listAccountClassifications(
      request.user.tenantId,
      query,
    );
  }

  @Post('account-classifications')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Create an account classification' })
  @RequirePermissions(AccountingPermission.ACCOUNT_CLASSIFICATIONS_CREATE)
  createAccountClassification(
    @Body() dto: CreateAccountClassificationDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.createAccountClassification(request.user, dto);
  }

  @Get('account-classifications/:classificationId')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Get an account classification' })
  @RequirePermissions(AccountingPermission.ACCOUNT_CLASSIFICATIONS_VIEW)
  getAccountClassification(
    @Param('classificationId', ParseUUIDPipe) classificationId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.getAccountClassification(
      request.user,
      classificationId,
    );
  }

  @Patch('account-classifications/:classificationId')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Update an account classification' })
  @RequirePermissions(AccountingPermission.ACCOUNT_CLASSIFICATIONS_EDIT)
  updateAccountClassification(
    @Param('classificationId', ParseUUIDPipe) classificationId: string,
    @Body() dto: UpdateAccountClassificationDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.updateAccountClassification(
      request.user,
      classificationId,
      dto,
    );
  }

  @Post('account-classifications/:classificationId/activate')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Reactivate an account classification' })
  @RequirePermissions(AccountingPermission.ACCOUNT_CLASSIFICATIONS_EDIT)
  activateAccountClassification(
    @Param('classificationId', ParseUUIDPipe) classificationId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.activateAccountClassification(
      request.user,
      classificationId,
    );
  }

  @Post('account-classifications/:classificationId/deactivate')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Deactivate an account classification' })
  @RequirePermissions(AccountingPermission.ACCOUNT_CLASSIFICATIONS_DEACTIVATE)
  deactivateAccountClassification(
    @Param('classificationId', ParseUUIDPipe) classificationId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.deactivateAccountClassification(
      request.user,
      classificationId,
    );
  }

  @Get('account-groups')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'List tenant account groups' })
  @RequirePermissions(AccountingPermission.ACCOUNT_GROUPS_VIEW)
  listAccountGroups(
    @Query() query: QueryAccountGroupsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.listAccountGroups(request.user.tenantId, query);
  }

  @Post('account-groups')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Create an account group' })
  @RequirePermissions(AccountingPermission.ACCOUNT_GROUPS_CREATE)
  createAccountGroup(
    @Body() dto: CreateAccountGroupDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.createAccountGroup(request.user, dto);
  }

  @Get('account-groups/:groupId')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Get an account group' })
  @RequirePermissions(AccountingPermission.ACCOUNT_GROUPS_VIEW)
  getAccountGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.getAccountGroup(request.user, groupId);
  }

  @Patch('account-groups/:groupId')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Update an account group' })
  @RequirePermissions(AccountingPermission.ACCOUNT_GROUPS_EDIT)
  updateAccountGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateAccountGroupDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.updateAccountGroup(request.user, groupId, dto);
  }

  @Post('account-groups/:groupId/activate')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Reactivate an account group' })
  @RequirePermissions(AccountingPermission.ACCOUNT_GROUPS_EDIT)
  activateAccountGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.activateAccountGroup(request.user, groupId);
  }

  @Post('account-groups/:groupId/deactivate')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({ summary: 'Deactivate an account group' })
  @RequirePermissions(AccountingPermission.ACCOUNT_GROUPS_DEACTIVATE)
  deactivateAccountGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.deactivateAccountGroup(request.user, groupId);
  }

  @Post('account-hierarchy/seed-standard')
  @ApiTags('Accounting - Account Hierarchy')
  @ApiOperation({
    summary:
      'Seed a safe standard account classification and group hierarchy for a tenant',
  })
  @RequirePermissions(
    AccountingPermission.ACCOUNT_CLASSIFICATIONS_CREATE,
    AccountingPermission.ACCOUNT_GROUPS_CREATE,
  )
  seedStandardAccountHierarchy(
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.seedStandardAccountHierarchy(request.user);
  }

  @Get('accounts')
  @ApiTags('Accounting - Chart of Accounts')
  @ApiOperation({ summary: 'List tenant GL accounts' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_VIEW)
  listAccounts(
    @Query() query: QueryGLAccountsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.listGLAccounts(request.user.tenantId, query);
  }

  @Post('accounts')
  @ApiTags('Accounting - Chart of Accounts')
  @ApiOperation({ summary: 'Create a tenant GL account' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_CREATE)
  createAccount(
    @Body() dto: CreateGLAccountDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.createGLAccount(request.user, dto);
  }

  @Patch('accounts/:accountId')
  @ApiTags('Accounting - Chart of Accounts')
  @ApiOperation({ summary: 'Update a tenant GL account' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_EDIT)
  updateAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: UpdateGLAccountDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.updateGLAccount(request.user, accountId, dto);
  }

  @Post('accounts/:accountId/deactivate')
  @ApiTags('Accounting - Chart of Accounts')
  @ApiOperation({ summary: 'Deactivate a GL account without deleting history' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_EDIT)
  deactivateAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.deactivateGLAccount(request.user, accountId);
  }

  @Get('accounts/:accountId/ledger')
  @ApiTags('Accounting - General Ledger')
  @ApiOperation({ summary: 'Get posted ledger lines for one GL account' })
  @RequirePermissions(AccountingPermission.LEDGER_VIEW)
  accountLedger(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.journals.accountLedger(request.user.tenantId, accountId);
  }

  @Get('cost-centres')
  @ApiTags('Accounting - Cost Centres')
  @ApiOperation({ summary: 'List tenant cost centres' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_VIEW)
  listCostCentres(@Req() request: Request & { user: RequestUser }) {
    return this.masterData.listCostCentres(request.user.tenantId);
  }

  @Post('cost-centres')
  @ApiTags('Accounting - Cost Centres')
  @ApiOperation({ summary: 'Create a tenant cost centre' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_CREATE)
  createCostCentre(
    @Body() dto: CreateCostCentreDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.createCostCentre(request.user, dto);
  }

  @Patch('cost-centres/:costCentreId')
  @ApiTags('Accounting - Cost Centres')
  @ApiOperation({ summary: 'Update a tenant cost centre' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_EDIT)
  updateCostCentre(
    @Param('costCentreId', ParseUUIDPipe) costCentreId: string,
    @Body() dto: UpdateCostCentreDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.updateCostCentre(request.user, costCentreId, dto);
  }

  @Post('cost-centres/:costCentreId/deactivate')
  @ApiTags('Accounting - Cost Centres')
  @ApiOperation({ summary: 'Deactivate a cost centre' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_EDIT)
  deactivateCostCentre(
    @Param('costCentreId', ParseUUIDPipe) costCentreId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.deactivateCostCentre(request.user, costCentreId);
  }

  @Get('subledger-accounts')
  @ApiTags('Accounting - Subledgers')
  @ApiOperation({
    summary: 'List tenant subledger accounts',
    description:
      'Returns subledger balances by Accounting control account. The same legal counterparty may therefore appear in separate premium, claims, receivable or payable dimensions without netting across control accounts.',
  })
  @RequirePermissions(AccountingPermission.ACCOUNTS_VIEW)
  listSubledgers(
    @Query() query: QuerySubledgerAccountsDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.listSubledgerAccounts(request.user.tenantId, query);
  }

  @Post('subledger-accounts')
  @ApiTags('Accounting - Subledgers')
  @ApiOperation({ summary: 'Create a tenant subledger account' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_CREATE)
  createSubledger(
    @Body() dto: CreateSubledgerAccountDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.createSubledgerAccount(request.user, dto);
  }

  @Patch('subledger-accounts/:subledgerId')
  @ApiTags('Accounting - Subledgers')
  @ApiOperation({ summary: 'Update a tenant subledger account' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_EDIT)
  updateSubledger(
    @Param('subledgerId', ParseUUIDPipe) subledgerId: string,
    @Body() dto: UpdateSubledgerAccountDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.updateSubledgerAccount(
      request.user,
      subledgerId,
      dto,
    );
  }

  @Post('subledger-accounts/:subledgerId/deactivate')
  @ApiTags('Accounting - Subledgers')
  @ApiOperation({ summary: 'Deactivate a subledger account' })
  @RequirePermissions(AccountingPermission.ACCOUNTS_EDIT)
  deactivateSubledger(
    @Param('subledgerId', ParseUUIDPipe) subledgerId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.deactivateSubledgerAccount(
      request.user,
      subledgerId,
    );
  }

  @Get('customers')
  @ApiTags('Accounting - Customers')
  @ApiOperation({ summary: 'List tenant accounting customers' })
  @RequirePermissions(AccountingPermission.CUSTOMERS_VIEW)
  listCustomers(
    @Query() query: QueryAccountingPartiesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.listCustomers(request.user.tenantId, query);
  }

  @Post('customers')
  @ApiTags('Accounting - Customers')
  @ApiOperation({
    summary: 'Create an accounting customer and linked subledger account',
  })
  @RequirePermissions(AccountingPermission.CUSTOMERS_CREATE)
  createCustomer(
    @Body() dto: CreateAccountingCustomerDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.createCustomer(request.user, dto);
  }

  @Get('customers/:customerId')
  @ApiTags('Accounting - Customers')
  @ApiOperation({ summary: 'Get accounting customer detail with balance' })
  @RequirePermissions(AccountingPermission.CUSTOMERS_VIEW)
  getCustomer(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.getCustomer(request.user, customerId);
  }

  @Patch('customers/:customerId')
  @ApiTags('Accounting - Customers')
  @ApiOperation({ summary: 'Update an accounting customer master record' })
  @RequirePermissions(AccountingPermission.CUSTOMERS_EDIT)
  updateCustomer(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Body() dto: UpdateAccountingCustomerDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.updateCustomer(request.user, customerId, dto);
  }

  @Post('customers/:customerId/deactivate')
  @ApiTags('Accounting - Customers')
  @ApiOperation({ summary: 'Deactivate a customer without deleting history' })
  @RequirePermissions(AccountingPermission.CUSTOMERS_DEACTIVATE)
  deactivateCustomer(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.deactivateCustomer(request.user, customerId);
  }

  @Post('customers/:customerId/activate')
  @ApiTags('Accounting - Customers')
  @ApiOperation({ summary: 'Reactivate a customer and linked subledger' })
  @RequirePermissions(AccountingPermission.CUSTOMERS_EDIT)
  activateCustomer(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.activateCustomer(request.user, customerId);
  }

  @Get('vendors')
  @ApiTags('Accounting - Vendors')
  @ApiOperation({ summary: 'List tenant accounting vendors' })
  @RequirePermissions(AccountingPermission.VENDORS_VIEW)
  listVendors(
    @Query() query: QueryAccountingPartiesDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.listVendors(request.user.tenantId, query);
  }

  @Post('vendors')
  @ApiTags('Accounting - Vendors')
  @ApiOperation({
    summary: 'Create an accounting vendor and linked subledger account',
  })
  @RequirePermissions(AccountingPermission.VENDORS_CREATE)
  createVendor(
    @Body() dto: CreateAccountingVendorDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.createVendor(request.user, dto);
  }

  @Get('vendors/:vendorId')
  @ApiTags('Accounting - Vendors')
  @ApiOperation({ summary: 'Get accounting vendor detail with balance' })
  @RequirePermissions(AccountingPermission.VENDORS_VIEW)
  getVendor(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.getVendor(request.user, vendorId);
  }

  @Patch('vendors/:vendorId')
  @ApiTags('Accounting - Vendors')
  @ApiOperation({ summary: 'Update an accounting vendor master record' })
  @RequirePermissions(AccountingPermission.VENDORS_EDIT)
  updateVendor(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Body() dto: UpdateAccountingVendorDto,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.updateVendor(request.user, vendorId, dto);
  }

  @Post('vendors/:vendorId/deactivate')
  @ApiTags('Accounting - Vendors')
  @ApiOperation({ summary: 'Deactivate a vendor without deleting history' })
  @RequirePermissions(AccountingPermission.VENDORS_DEACTIVATE)
  deactivateVendor(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.deactivateVendor(request.user, vendorId);
  }

  @Post('vendors/:vendorId/activate')
  @ApiTags('Accounting - Vendors')
  @ApiOperation({ summary: 'Reactivate a vendor and linked subledger' })
  @RequirePermissions(AccountingPermission.VENDORS_EDIT)
  activateVendor(
    @Param('vendorId', ParseUUIDPipe) vendorId: string,
    @Req() request: Request & { user: RequestUser },
  ) {
    return this.masterData.activateVendor(request.user, vendorId);
  }
}
