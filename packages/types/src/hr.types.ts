export enum EmploymentType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  CONTRACT = 'CONTRACT',
  INTERN = 'INTERN',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  TERMINATED = 'TERMINATED',
}

export interface Employee {
  id: string;
  tenantId: string;
  employeeNo: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string;
  jobTitleId: string;
  managerId?: string;
  employmentType: EmploymentType;
  startDate: Date;
  status: EmployeeStatus;
}
