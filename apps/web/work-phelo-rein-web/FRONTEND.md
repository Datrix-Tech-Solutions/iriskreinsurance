# WorkPhelo Frontend — Developer Guide

This guide is for the frontend developer joining the project. Everything in this document tells you exactly how to build pages, use the API, and follow the patterns already set up.

---

## Setup

```bash
cd apps/web/work-phelo-web

npm install

cp .env.example .env.local

npm run dev
# → http://localhost:3000
```

---

---

## How to Build a Page

### 1. Use the hooks — never call `api` directly from a page

Every endpoint is already wrapped in a hook in `src/hooks/`. Just import and use:

```tsx
// ✅ Correct
import { useEmployees } from '@/hooks';

export default function EmployeesPage() {
  const { data, isLoading, error } = useEmployees();
  // ...
}

// ❌ Wrong — never do this in a page
import { api } from '@/lib/api';
const res = await api.get('/hr/employees');
```

### 2. Handle errors with extractError()

```tsx
import { extractError } from '@/lib/errors';
import { useCreateEmployee } from '@/hooks';

const create = useCreateEmployee();

const handleSubmit = async (data: CreateEmployeePayload) => {
  try {
    await create.mutateAsync(data);
    // success
  } catch (error) {
    const message = extractError(error);
    // show message to user
  }
};
```

### 3. Get the current user from the auth store

```tsx
import { useAuthStore } from '@/store/auth.store';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  // user.role, user.tenantSlug, user.firstName, etc.
}
```

---

## Available Hooks

### Auth

```ts
useMe(); // Get current user
useLogin(); // Tenant login
useSuperAdminLogin(); // Super Admin login
useLogout(); // Logout + redirect
useForgotPassword(); // Send OTP to email
useResetPassword(); // Reset with token
useChangePassword(); // Change password (authenticated)
useAcceptInvite(); // Accept invite + set password
```

### Tenants (Super Admin only)

```ts
useTenants(); // List all companies
useRegisterTenant(); // Onboard new company
useApproveTenant(); // Activate a company
useSuspendTenant(); // Suspend a company
useAssignAdmin(); // Assign Company Admin
useResendInvite(); // Resend invite email
```

### Dashboard

```ts
useDashboardSummary(); // Company stats for tenant admin
```

### Departments

```ts
useDepartments(); // List departments
useDepartment(id); // Get one department
useCreateDepartment(); // Create department
useUpdateDepartment(); // Update department
useDeleteDepartment(); // Delete department
```

### Employees

```ts
useEmployees(query?)       // List employees (supports search, filter, pagination)
useEmployee(id)            // Get one employee
useMyProfile()             // Get logged-in employee's profile
useCreateEmployee()        // Create employee (triggers invite email automatically)
useUpdateEmployee()        // Update employee
useOffboardEmployee()      // Offboard employee
useResendEmployeeInvite()  // Resend invite to employee
```

### Leave

```ts
useLeaveTypes()            // List leave types
useCreateLeaveType()       // Create leave type
useLeaveRequests(status?)  // List leave requests
useMyLeaveRequests()       // My own leave requests
useLeaveBalances(employeeId?) // Leave balances
useCreateLeaveRequest()    // Submit leave request
useReviewLeaveRequest()    // Approve or reject
useCancelLeaveRequest()    // Cancel a request
```

### Payroll

```ts
usePayrollRuns(); // List payroll runs
usePayrollRun(id); // Get one payroll run
useMyPayslips(); // My payslips
useRunPayroll(); // Run payroll for a period
useApprovePayroll(); // Approve a payroll run
useMarkPayrollPaid(); // Mark payroll as paid
```

---

## Route Structure

| URL                           | Page                    | Who can access        |
| ----------------------------- | ----------------------- | --------------------- |
| `/login`                      | Super Admin login       | Super Admin           |
| `/platform/dashboard`         | Super Admin portal      | Super Admin           |
| `/:tenantSlug/login`          | Tenant login            | Everyone              |
| `/:tenantSlug/dashboard`      | Company Admin dashboard | Tenant Admin          |
| `/:tenantSlug/accept-invite`  | Set password (invite)   | New users             |
| `/:tenantSlug/reset-password` | Set new password        | All users             |
| `/:tenantSlug/employees`      | Employee list           | Tenant Admin, Manager |
| `/:tenantSlug/leave`          | Leave management        | All employees         |
| `/:tenantSlug/payroll`        | Payroll                 | Tenant Admin          |

---

## Atomic Design Rules

| Layer                                        | Rule                                                    |
| -------------------------------------------- | ------------------------------------------------------- |
| **Atoms** — `Button`, `Input`, `Badge`       | Pure UI only. No hooks, no API calls, no business logic |
| **Molecules** — `FormField`, `StatusBadge`   | Combines atoms. No API calls                            |
| **Organisms** — `EmployeeTable`, `LeaveForm` | Can use hooks. No direct `api` calls                    |
| **Templates** — `DashboardLayout`            | Layout only. No data fetching                           |
| **Pages** — `app/`                           | Data fetching lives here. Use hooks                     |

---

## Styling

Use Tailwind CSS utility classes. For conditional classes use the `cn()` helper:

```tsx
import { cn } from '@/lib/utils';

<div className={cn('p-4 rounded-lg', isActive && 'bg-green-100', isError && 'bg-red-100')}>
```

Brand colors:

- Primary: `orange-500` (#F97316)
- Text: `gray-900`
- Subtle text: `gray-500`
- Border: `gray-200`
- Background: `gray-50`

---

## Test Credentials

| Role          | URL                 | Email                      | Password       |
| ------------- | ------------------- | -------------------------- | -------------- |
| Super Admin   | `/login`            | superadmin@datrix.com      | SuperAdmin123! |
| Company Admin | `/acme-ghana/login` | admin@acmeghana.com        | Admin123!      |
| HR Manager    | `/acme-ghana/login` | hr.manager@acmeghana.com   | Manager123!    |
| Employee      | `/acme-ghana/login` | kofi.boateng@acmeghana.com | Employee123!   |

---

## Before You Push

Always run these locally first:

```bash
npx tsc --noEmit    # must pass with 0 errors
npm run build       # must succeed
```

Never push if either of these fail — the CI pipeline will reject it.

---
