export const EMPLOYEE_IMPORT_REQUIRED_COLUMNS = [
  'firstName',
  'lastName',
  'email',
  'department',
  'jobTitle',
  'employmentType',
  'hireDate',
] as const;

export const EMPLOYEE_IMPORT_OPTIONAL_COLUMNS = [
  'employeeNumber',
  'phone',
  'gender',
  'dateOfBirth',
  'maritalStatus',
  'nationality',
  'address',
  'city',
  'region',
  'branch',
  'managerEmail',
  'managerEmployeeNumber',
  'probationEndsAt',
  'contractEndDate',
  'basicSalary',
  'nationalId',
  'bankName',
  'bankAccountNumber',
  'bankBranch',
  'ssnit',
  'tinNumber',
  'emergencyName',
  'emergencyPhone',
  'emergencyRelation',
] as const;

export const EMPLOYEE_IMPORT_COLUMNS = [
  ...EMPLOYEE_IMPORT_REQUIRED_COLUMNS,
  ...EMPLOYEE_IMPORT_OPTIONAL_COLUMNS,
] as const;

export type EmployeeImportColumn = (typeof EMPLOYEE_IMPORT_COLUMNS)[number];

export const EMPLOYEE_IMPORT_TEMPLATE_FILENAME =
  'workphelo-employee-import-template.csv';

export const EMPLOYEE_IMPORT_TEMPLATE_SAMPLE_ROW: Record<
  EmployeeImportColumn,
  string
> = {
  firstName: 'Ama',
  lastName: 'Mensah',
  email: 'ama.mensah@example.com',
  department: 'Human Resources',
  jobTitle: 'HR Officer',
  employmentType: 'FULL_TIME',
  hireDate: '2026-01-05',
  employeeNumber: 'EMP-0001',
  phone: '+233244000001',
  gender: 'FEMALE',
  dateOfBirth: '1990-01-15',
  maritalStatus: 'SINGLE',
  nationality: 'Ghanaian',
  address: '123 Example Street',
  city: 'Accra',
  region: 'Greater Accra',
  branch: 'Head Office',
  managerEmail: 'manager@example.com',
  managerEmployeeNumber: 'EMP-0000',
  probationEndsAt: '2026-04-05',
  contractEndDate: '',
  basicSalary: '3500',
  nationalId: 'GHA-000000000-0',
  bankName: 'GCB Bank',
  bankAccountNumber: '1234567890',
  bankBranch: 'Accra Main',
  ssnit: 'P00123456',
  tinNumber: 'P0012345678',
  emergencyName: 'Kofi Mensah',
  emergencyPhone: '+233244000002',
  emergencyRelation: 'Spouse',
};

export function buildEmployeeImportTemplateCsv() {
  return [
    EMPLOYEE_IMPORT_COLUMNS.join(','),
    EMPLOYEE_IMPORT_COLUMNS.map((column) =>
      escapeCsvValue(EMPLOYEE_IMPORT_TEMPLATE_SAMPLE_ROW[column]),
    ).join(','),
    '',
  ].join('\n');
}

function escapeCsvValue(value: string) {
  if (!/[",\n\r]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}
