'use client';

import {
  useEmployeeOptions,
  useAssets,
  // usePayrollRuns,
  // useAttendanceStats,
  useDepartments,
  useBranches,
  useProjects,
  useLeaveRequests,
} from '@/hooks';
import { ModuleIcons, MODULE_COLORS } from '@/components/atoms/icons';
// import { formatPayrollMoney } from '@/lib/payrollDisplay';
import { ModuleOverviewCard } from '@/components/molecules/executive/ModuleOverviewCard';
import { BentoTile, TileLabel, TileValue } from '@/components/molecules/executive/BentoTile';

// Matches EmployeeDirectory's headcount — excludes suspended/offboarded staff.
const RESTRICTED_STATUSES = ['SUSPENDED', 'OFFBOARDED'];

/** Most recently run payroll — used for the "Payroll (employer)" tile. */
// function useLatestPayrollRun() {
//   const { data: runs } = usePayrollRuns();
//   return [...(runs ?? [])].sort((a, b) => b.year - a.year || b.month - a.month)[0];
// }

function useOnLeaveToday() {
  const { data: approved } = useLeaveRequests('APPROVED');
  const today = new Date().toISOString().slice(0, 10);
  return approved?.filter((r) => r.startDate <= today && r.endDate >= today).length;
}

export function HrOverviewCard() {
  const color = MODULE_COLORS.hr;
  const { data: employees } = useEmployeeOptions();
  const { data: assets } = useAssets();
  // const payrollRun = useLatestPayrollRun();
  // const { data: attendance } = useAttendanceStats();
  const { data: departments } = useDepartments();
  const { data: branches } = useBranches();
  const { data: projects } = useProjects();
  const onLeaveToday = useOnLeaveToday();

  const employeeCount = employees?.filter(
    (e) => !RESTRICTED_STATUSES.includes(e.employmentStatus),
  ).length;
  const activeProjects = projects?.filter((p) => p.status === 'ACTIVE').length;
  const assignedAssets = assets?.filter((a) => a.status === 'ASSIGNED').length;

  return (
    <ModuleOverviewCard
      name="Human Resource"
      icon={<ModuleIcons.hr className="w-4 h-4" />}
      color={color}
    >
      <div className="flex flex-col gap-2">
        {/* Row 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <BentoTile color={color}>
            <TileLabel color={color}>Employees</TileLabel>
            <TileValue color={color} value={employeeCount} />
          </BentoTile>
          {/* <BentoTile color={color}>
            <TileLabel color={color}>Clocked in today</TileLabel>
            <TileValue color={color} value={attendance?.clockedIn} total={attendance?.total} />
          </BentoTile> */}
          <BentoTile color={color}>
            <TileLabel color={color}>On leave today</TileLabel>
            <TileValue color={color} value={onLeaveToday} />
          </BentoTile>
          <BentoTile color={color}>
            <TileLabel color={color}>Active projects</TileLabel>
            <TileValue color={color} value={activeProjects} total={projects?.length} />
          </BentoTile>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          {/* <BentoTile color={color} className="lg:col-span-2">
            <TileLabel color={color}>Payroll</TileLabel>
            <div className="flex divide-x divide-gray-200 mt-2">
              <div className="pr-4">
                <p className="text-xs text-gray-500 mb-1">Total</p>
                <p className="text-lg font-bold text-gray-900">
                  {payrollRun
                    ? formatPayrollMoney(
                        payrollRun.totalEmployerCost,
                        payrollRun.payrollCurrency,
                        payrollRun.payrollCountry,
                      )
                    : '—'}
                </p>
              </div>
              <div className="px-4">
                <p className="text-xs text-gray-500 mb-1">SSNIT</p>
                <p className="text-lg font-bold text-gray-900">
                  {payrollRun
                    ? formatPayrollMoney(
                        payrollRun.totalSSNIT,
                        payrollRun.payrollCurrency,
                        payrollRun.payrollCountry,
                      )
                    : '—'}
                </p>
              </div>
              <div className="pl-4">
                <p className="text-xs text-gray-500 mb-1">PAYE</p>
                <p className="text-lg font-bold text-gray-900">
                  {payrollRun
                    ? formatPayrollMoney(
                        payrollRun.totalPAYE,
                        payrollRun.payrollCurrency,
                        payrollRun.payrollCountry,
                      )
                    : '—'}
                </p>
              </div>
            </div>
          </BentoTile> */}
          <BentoTile color={color}>
            <TileLabel color={color}>Assets assigned</TileLabel>
            <TileValue color={color} value={assignedAssets} total={assets?.length} />
          </BentoTile>
          <BentoTile color={color}>
            <div className="flex divide-x divide-gray-200">
              <div className="pr-4">
                <p className="text-xs text-gray-500 mb-1">Departments</p>
                <p className="text-2xl font-bold text-gray-900">{departments?.length ?? '—'}</p>
              </div>
              <div className="pl-4">
                <p className="text-xs text-gray-500 mb-1">Branches</p>
                <p className="text-2xl font-bold text-gray-900">{branches?.length ?? '—'}</p>
              </div>
            </div>
          </BentoTile>
        </div>

        {/* Row 3 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* <BentoTile color={color}>
            <div className="flex divide-x divide-gray-200">
              <div className="pr-4">
                <p className="text-xs text-gray-500 mb-1">Departments</p>
                <p className="text-2xl font-bold text-gray-900">{departments?.length ?? '—'}</p>
              </div>
              <div className="pl-4">
                <p className="text-xs text-gray-500 mb-1">Branches</p>
                <p className="text-2xl font-bold text-gray-900">{branches?.length ?? '—'}</p>
              </div>
            </div>
          </BentoTile> */}
        </div>
      </div>
    </ModuleOverviewCard>
  );
}
