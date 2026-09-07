-- Drop FK from User to CompanyRole
ALTER TABLE w_auth."User" DROP COLUMN IF EXISTS "companyRoleId";

-- Drop CompanyRole table
DROP TABLE IF EXISTS w_auth."CompanyRole";
