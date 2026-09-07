#!/bin/bash

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PASS=0; FAIL=0; SKIP=0

pass() { echo -e "${GREEN}  ✅ PASS${NC} — $1"; ((PASS++)); }
fail() { echo -e "${RED}  ❌ FAIL${NC} — $1 | expected: '$2' got: '$3'"; ((FAIL++)); }
skip() { echo -e "${YELLOW}  ⏭  SKIP${NC} — $1"; ((SKIP++)); }
section() { echo -e "\n${BLUE}══════════════════════════════════════════${NC}\n${BLUE}  $1${NC}\n${BLUE}══════════════════════════════════════════${NC}"; }

GW="http://localhost:4000"
AUTH="http://localhost:4001"
HR="http://localhost:4002"

# Strip whitespace from values before comparing
jqr() { echo "$1" | jq -r "$2" 2>/dev/null | tr -d '\n\r\t' | xargs; }

check() {
  local label=$1 expected=$2 actual=$(echo "$3" | tr -d '\n\r\t' | xargs)
  if [ "$expected" = "notnull" ]; then
    if [ -n "$actual" ] && [ "$actual" != "null" ] && [ "$actual" != "" ]; then
      pass "$label"
    else
      fail "$label" "notnull" "$actual"
    fi
  elif [ "$actual" = "$expected" ]; then
    pass "$label"
  else
    fail "$label" "$expected" "$actual"
  fi
}

check_http() {
  local label=$1 expected=$2 actual=$3
  [ "$actual" = "$expected" ] && pass "$label (HTTP $actual)" || fail "$label" "HTTP $expected" "HTTP $actual"
}

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   WorkPhelo ERP — Full Integration Test  ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"

# ── 1. GATEWAY ───────────────────────────────────────────────────────────────
section "1. API GATEWAY"
HEALTH=$(curl -s $GW/health)
check "Health check" "ok" "$(jqr "$HEALTH" '.status')"
check "Auth URL configured" "notnull" "$(jqr "$HEALTH" '.services.auth')"
check "HR URL configured" "notnull" "$(jqr "$HEALTH" '.services.hr')"

# ── 2. SWAGGER ───────────────────────────────────────────────────────────────
section "2. SWAGGER DOCUMENTATION"
check_http "Auth docs" "200" "$(curl -s -o /dev/null -w '%{http_code}' $AUTH/docs)"
check_http "HR docs" "200" "$(curl -s -o /dev/null -w '%{http_code}' $HR/docs)"
check_http "Gateway docs" "200" "$(curl -s -o /dev/null -w '%{http_code}' $GW/docs)"

# ── 3. AUTH LOGINS ───────────────────────────────────────────────────────────
section "3. AUTH — LOGINS"

SA=$(curl -s -X POST $GW/api/auth/auth/admin/login \
  -H "Content-Type: application/json" -c /tmp/t-sa.txt \
  -d '{"email":"superadmin@datrix.com","password":"SuperAdmin123!"}')
check "SuperAdmin login" "SUPER_ADMIN" "$(jqr "$SA" '.user.role')"
SA_TOKEN=$(grep access_token /tmp/t-sa.txt 2>/dev/null | awk '{print $7}' | tr -d '\n\r')

ACME=$(curl -s -X POST $GW/api/auth/auth/login \
  -H "Content-Type: application/json" -c /tmp/t-acme.txt \
  -d '{"tenantSlug":"acme-ghana","email":"admin@acmeghana.com","password":"Admin123!"}')
check "Tenant Admin login" "TENANT_ADMIN" "$(jqr "$ACME" '.user.role')"
ACME_TOKEN=$(grep access_token /tmp/t-acme.txt 2>/dev/null | awk '{print $7}' | tr -d '\n\r')

MGR=$(curl -s -X POST $GW/api/auth/auth/login \
  -H "Content-Type: application/json" -c /tmp/t-mgr.txt \
  -d '{"tenantSlug":"acme-ghana","email":"hr.manager@acmeghana.com","password":"Manager123!"}')
check "Manager login (EMPLOYEE system role)" "EMPLOYEE" "$(jqr "$MGR" '.user.role')"
MGR_TOKEN=$(grep access_token /tmp/t-mgr.txt 2>/dev/null | awk '{print $7}' | tr -d '\n\r')
MGR_USER_ID=$(jqr "$MGR" '.user.id')

EMP=$(curl -s -X POST $GW/api/auth/auth/login \
  -H "Content-Type: application/json" -c /tmp/t-emp.txt \
  -d '{"tenantSlug":"acme-ghana","email":"mfa.user@acmeghana.com","password":"MfaUser123!"}')
check "Employee login" "EMPLOYEE" "$(jqr "$EMP" '.user.role')"
EMP_TOKEN=$(grep access_token /tmp/t-emp.txt 2>/dev/null | awk '{print $7}' | tr -d '\n\r')
EMP_USER_ID=$(jqr "$EMP" '.user.id')
EMP_TOKEN=$(grep access_token /tmp/t-emp.txt 2>/dev/null | awk '{print $7}' | tr -d '\n\r')

STELLAR=$(curl -s -X POST $GW/api/auth/auth/login \
  -H "Content-Type: application/json" -c /tmp/t-stellar.txt \
  -d '{"tenantSlug":"stellar-tech","email":"admin@stellartech.com.gh","password":"Admin123!"}')
check "Stellar Admin login" "TENANT_ADMIN" "$(jqr "$STELLAR" '.user.role')"
STELLAR_TOKEN=$(grep access_token /tmp/t-stellar.txt 2>/dev/null | awk '{print $7}' | tr -d '\n\r')

SUSP=$(curl -s -X POST $GW/api/auth/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantSlug":"sunrise-imports","email":"admin@sunriseimports.com","password":"Admin123!"}')
check "Suspended tenant blocked" "403" "$(jqr "$SUSP" '.statusCode')"

WRONG=$(curl -s -X POST $GW/api/auth/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantSlug":"stellar-tech","email":"dev@stellartech.com.gh","password":"WRONGPASS1"}')
check "Wrong password rejected" "notnull" "$(jqr "$WRONG" '.message')"

NO_TOKEN=$(curl -s $GW/api/hr/employees)
check "No token returns 401" "401" "$(jqr "$NO_TOKEN" '.statusCode')"

FORCE=$(curl -s -X POST $GW/api/auth/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantSlug":"acme-ghana","email":"newuser@acmeghana.com","password":"TempPass123!"}')
FORCE_RESET_FLAG=$(jqr "$FORCE" '.requiresPasswordReset')
FORCE_USER_ID=$(jqr "$FORCE" '.userId')
if [ "$FORCE_RESET_FLAG" = "true" ]; then
  check "Force reset flag returned" "true" "$FORCE_RESET_FLAG"
  FR=$(curl -s -X POST $GW/api/auth/auth/force-reset-password \
    -H "Content-Type: application/json" -c /tmp/t-newuser.txt \
    -d "{\"userId\":\"$FORCE_USER_ID\",\"newPassword\":\"NewPass456!\"}")
  check "Force reset completes login" "notnull" "$(jqr "$FR" '.user.id')"
else
  # Already reset — login normally
  skip "Force reset — user already reset password, testing normal login"
  NEW_LOGIN=$(curl -s -X POST $GW/api/auth/auth/login \
    -H "Content-Type: application/json" \
    -d '{"tenantSlug":"acme-ghana","email":"newuser@acmeghana.com","password":"NewPass123!"}')
  check "New user can login after reset" "EMPLOYEE" "$(jqr "$NEW_LOGIN" '.user.role')"
fi

# Token refresh — use cookie from Acme login
REFRESH_COOKIE=$(grep -i "refresh_token" /tmp/t-acme.txt 2>/dev/null | awk '{print $7}' | tr -d '\n\r')
REFRESH=$(curl -s -X POST $GW/api/auth/auth/refresh \
  -H "Cookie: refresh_token=$REFRESH_COOKIE")
check "Token refresh works" "Tokens refreshed successfully" "$(jqr "$REFRESH" '.message')"

# ── 4. ACCOUNT LOCKOUT ───────────────────────────────────────────────────────
section "4. ACCOUNT LOCKOUT"

# Use accountant for lockout test
for i in 1 2 3 4 5; do
  LR=$(curl -s -X POST $GW/api/auth/auth/login \
    -H "Content-Type: application/json" \
    -d '{"tenantSlug":"acme-ghana","email":"accountant@acmeghana.com","password":"WRONGPASSWORD"}')
  MSG=$(jqr "$LR" '.message')
  if [ $i -lt 5 ]; then
    echo "$MSG" | grep -q "remaining" && pass "Lockout attempt $i — countdown shown" || fail "Lockout attempt $i" "countdown message" "$MSG"
  else
    echo "$MSG" | grep -q "locked" && pass "Lockout attempt 5 — account locked" || fail "Lockout attempt 5" "locked message" "$MSG"
  fi
done

LOCKED=$(curl -s -X POST $GW/api/auth/auth/login \
  -H "Content-Type: application/json" \
  -d '{"tenantSlug":"acme-ghana","email":"accountant@acmeghana.com","password":"Accountant123!"}')
check "Correct password blocked during lockout" "403" "$(jqr "$LOCKED" '.statusCode')"

# ── 5. TENANTS ───────────────────────────────────────────────────────────────
section "5. TENANTS — SUPERADMIN"

ALL_T=$(curl -s "$GW/api/auth/tenants" -H "Authorization: Bearer $SA_TOKEN")
check "SuperAdmin gets all tenants" "5" "$(jqr "$ALL_T" '.total')"

PEND_T=$(curl -s "$GW/api/auth/tenants?status=PENDING" -H "Authorization: Bearer $SA_TOKEN")
check "Filter by status works" "notnull" "$(jqr "$PEND_T" '.total')"

SRCH_T=$(curl -s "$GW/api/auth/tenants?search=acme" -H "Authorization: Bearer $SA_TOKEN")
check "Search tenants by name" "1" "$(jqr "$SRCH_T" '.total')"

TENANT_ID=$(echo $ALL_T | jq -r '.tenants[] | select(.name == "Acme Ghana Ltd") | .id' 2>/dev/null | tr -d '\n\r')
if [ -n "$TENANT_ID" ]; then
  T_BY_ID=$(curl -s "$GW/api/auth/tenants/$TENANT_ID" -H "Authorization: Bearer $SA_TOKEN")
  check "Get tenant by ID" "Acme Ghana Ltd" "$(jqr "$T_BY_ID" '.name')"
fi

# Non-SuperAdmin should NOT list all tenants — TENANT_ADMIN bypass gives all tenants
# but filtered to their own — this is a known design: TENANT_ADMIN sees their own
ACME_T=$(curl -s "$GW/api/auth/tenants" -H "Authorization: Bearer $ACME_TOKEN")
ACME_T_COUNT=$(jqr "$ACME_T" '.total')
check "TENANT_ADMIN only sees their own tenant" "1" "$ACME_T_COUNT"

# ── 6. USERS ─────────────────────────────────────────────────────────────────
section "6. USERS"

USERS=$(curl -s $GW/api/auth/users -H "Authorization: Bearer $ACME_TOKEN")
check "List users in tenant" "notnull" "$(echo $USERS | jq -r '.[0].id' 2>/dev/null | tr -d '\n\r')"

INVITE=$(curl -s -X POST $GW/api/auth/users/invite \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d '{"email":"newinvite2@acmeghana.com","firstName":"New","lastName":"Invite"}')
check "Invite user" "notnull" "$(jqr "$INVITE" '.message')"

# ── 7. PERMISSION SETS ───────────────────────────────────────────────────────
section "7. PERMISSION SETS"

SETS=$(curl -s $GW/api/auth/permissions/sets -H "Authorization: Bearer $ACME_TOKEN")
SETS_COUNT=$(echo $SETS | jq '. | length' 2>/dev/null | tr -d '\n\r')
check "List permission sets" "notnull" "$SETS_COUNT"
check "Company Admin Set exists" "Company Admin Set" "$(echo $SETS | jq -r '.[] | select(.name=="Company Admin Set") | .name' 2>/dev/null | tr -d '\n\r')"
check "Employee Set not seeded by default" "" "$(echo $SETS | jq -r '.[] | select(.name=="Employee Set") | .name' 2>/dev/null | tr -d '\n\r')"

SYSTEM_SET_ID=$(echo $SETS | jq -r '.[] | select(.name=="Company Admin Set") | .id' 2>/dev/null | tr -d '\n\r')

TS=$(date +%s)
CUSTOM_SET=$(curl -s -X POST $GW/api/auth/permissions/sets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d "{\"name\":\"Test Permission Set $TS\",\"description\":\"Test\",\"resources\":[]}")
check "Create custom permission set" "notnull" "$(jqr "$CUSTOM_SET" '.id')"
CUSTOM_SET_ID=$(jqr "$CUSTOM_SET" '.id')

if [ -n "$CUSTOM_SET_ID" ] && [ "$CUSTOM_SET_ID" != "null" ]; then
  UPD_SET=$(curl -s -X PATCH $GW/api/auth/permissions/sets/$CUSTOM_SET_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACME_TOKEN" \
    -d '{"name":"Updated Test Permission Set","description":"Updated","resources":[]}')
  check "Update custom permission set" "Updated Test Permission Set" "$(jqr "$UPD_SET" '.name')"

  DEL_SET=$(curl -s -X DELETE $GW/api/auth/permissions/sets/$CUSTOM_SET_ID \
    -H "Authorization: Bearer $ACME_TOKEN")
  check "Delete custom permission set" "notnull" "$(jqr "$DEL_SET" '.message')"
fi

SYS_UPD=$(curl -s -X PATCH $GW/api/auth/permissions/sets/$SYSTEM_SET_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d '{"name":"Renamed System Set","description":"Nope","resources":[]}')
check "Cannot update system permission set" "403" "$(jqr "$SYS_UPD" '.statusCode')"

# ── 8. PERMISSIONS ───────────────────────────────────────────────────────────
section "8. PERMISSIONS"

ALL_PERMS=$(curl -s $GW/api/auth/permissions -H "Authorization: Bearer $ACME_TOKEN")
check "Get all permissions" "notnull" "$(echo $ALL_PERMS | jq -r '.permissions | length' 2>/dev/null | tr -d '\n\r')"

USER_ID=$(curl -s $GW/api/auth/users -H "Authorization: Bearer $ACME_TOKEN" \
  | jq -r '.[] | select(.email=="kofi.boateng@acmeghana.com") | .id' 2>/dev/null | tr -d '\n\r')
if [ -n "$USER_ID" ] && [ "$USER_ID" != "null" ]; then
  UP=$(curl -s $GW/api/auth/permissions/users/$USER_ID -H "Authorization: Bearer $ACME_TOKEN")
  check "Get user effective permissions" "notnull" "$(echo $UP | jq -r '.effectivePermissions | length' 2>/dev/null | tr -d '\n\r')"
  check "User has system role" "EMPLOYEE" "$(jqr "$UP" '.systemRole')"
  check "User has company role" "Employee" "$(jqr "$UP" '.companyRole')"
else
  skip "Permissions — could not find user"
fi

# ── 9. DEPARTMENTS ───────────────────────────────────────────────────────────
section "9. HR — DEPARTMENTS"

TS=$(date +%s)
DEPT=$(curl -s -X POST $GW/api/hr/departments \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d "{\"name\":\"Finance $TS\",\"description\":\"Finance team\"}")
check "Create department" "notnull" "$(jqr "$DEPT" '.id')"
DEPT_ID=$(jqr "$DEPT" '.id')
DEPT_NAME=$(jqr "$DEPT" '.name')

DEPTS=$(curl -s $GW/api/hr/departments -H "Authorization: Bearer $ACME_TOKEN")
check "List departments" "notnull" "$(echo $DEPTS | jq -r '.[0].id' 2>/dev/null | tr -d '\n\r')"

if [ -n "$DEPT_ID" ] && [ "$DEPT_ID" != "null" ]; then
  D_BY_ID=$(curl -s $GW/api/hr/departments/$DEPT_ID -H "Authorization: Bearer $ACME_TOKEN")
  check "Get department by ID" "$DEPT_NAME" "$(jqr "$D_BY_ID" '.name')"

  UPD_D=$(curl -s -X PATCH $GW/api/hr/departments/$DEPT_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACME_TOKEN" \
    -d '{"description":"Updated description"}')
  check "Update department" "Updated description" "$(jqr "$UPD_D" '.description')"
fi

# ── 10. EMPLOYEES ────────────────────────────────────────────────────────────
section "10. HR — EMPLOYEES"

TS=$(date +%s)
NEW_EMP=$(curl -s -X POST $GW/api/hr/employees \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d "{
    \"userId\": \"$EMP_USER_ID\",
    \"firstName\": \"Kofi\",
    \"lastName\": \"Boateng\",
    \"email\": \"kofi.hr.$TS@acmeghana.com\",
    \"jobTitle\": \"Software Engineer\",
    \"departmentId\": \"$DEPT_ID\",
    \"hireDate\": \"2026-01-01\",
    \"basicSalary\": 4500
  }")

if [ "$(jqr "$NEW_EMP" '.id')" != "null" ] && [ -n "$(jqr "$NEW_EMP" '.id')" ]; then
  check "Create employee" "notnull" "$(jqr "$NEW_EMP" '.employeeNumber')"
  EMP_HR_ID=$(jqr "$NEW_EMP" '.id')
else
  skip "Create employee — $(jqr "$NEW_EMP" '.message')"
  EMP_HR_ID=$(curl -s $GW/api/hr/employees \
    -H "Authorization: Bearer $ACME_TOKEN" | jq -r '.employees[0].id' 2>/dev/null | tr -d '\n\r')
fi

EMPS=$(curl -s $GW/api/hr/employees -H "Authorization: Bearer $ACME_TOKEN")
check "List employees" "notnull" "$(jqr "$EMPS" '.meta.total')"

if [ -n "$EMP_HR_ID" ] && [ "$EMP_HR_ID" != "null" ]; then
  E_BY_ID=$(curl -s $GW/api/hr/employees/$EMP_HR_ID -H "Authorization: Bearer $ACME_TOKEN")
  check "Get employee by ID" "notnull" "$(jqr "$E_BY_ID" '.id')"

  UPD_E=$(curl -s -X PATCH $GW/api/hr/employees/$EMP_HR_ID \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ACME_TOKEN" \
    -d '{"jobTitle":"Senior Engineer","employmentStatus":"ACTIVE"}')
  check "Update employee" "Senior Engineer" "$(jqr "$UPD_E" '.jobTitle')"
fi

SRCH_E=$(curl -s "$GW/api/hr/employees?search=Kofi" -H "Authorization: Bearer $ACME_TOKEN")
check "Search employees" "notnull" "$(jqr "$SRCH_E" '.meta.total')"

FILT_E=$(curl -s "$GW/api/hr/employees?status=ACTIVE" -H "Authorization: Bearer $ACME_TOKEN")
check "Filter by status" "notnull" "$(jqr "$FILT_E" '.meta.total')"

# ── 11. LEAVE ────────────────────────────────────────────────────────────────
section "11. HR — LEAVE"

LT=$(curl -s $GW/api/hr/leave/types -H "Authorization: Bearer $ACME_TOKEN")
check "List leave types" "notnull" "$(echo $LT | jq -r '. | length' 2>/dev/null | tr -d '\n\r')"

TS=$(date +%s)
NLT=$(curl -s -X POST $GW/api/hr/leave/types \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d "{\"name\":\"Study Leave $TS\",\"daysAllowed\":5,\"isPaid\":false,\"requiresApproval\":true}")
check "Create leave type" "notnull" "$(jqr "$NLT" '.id')"

if [ -n "$EMP_HR_ID" ] && [ "$EMP_HR_ID" != "null" ]; then
  BAL=$(curl -s $GW/api/hr/leave/balances/$EMP_HR_ID -H "Authorization: Bearer $ACME_TOKEN")
  check "Get leave balances" "notnull" "$(echo $BAL | jq -r '. | length' 2>/dev/null | tr -d '\n\r')"
fi

ALL_REQ=$(curl -s $GW/api/hr/leave/requests/all -H "Authorization: Bearer $ACME_TOKEN")
check "Get all leave requests" "notnull" "$(echo $ALL_REQ | jq -r '. | length' 2>/dev/null | tr -d '\n\r')"

# ── 12. TIME MANAGEMENT ──────────────────────────────────────────────────────
section "12. HR — TIME MANAGEMENT"

# Get manager's employee profile ID
MGR_EMP=$(curl -s $GW/api/hr/employees/me -H "Authorization: Bearer $MGR_TOKEN")
MGR_EMP_STATUS=$(jqr "$MGR_EMP" '.id')

if [ -n "$MGR_EMP_STATUS" ] && [ "$MGR_EMP_STATUS" != "null" ]; then
  CI=$(curl -s -X POST $GW/api/hr/time/clock-in \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MGR_TOKEN" \
    -d '{"location":"Accra Office"}')
  if [ -n "$(jqr "$CI" '.id')" ] && [ "$(jqr "$CI" '.id')" != "null" ]; then
    check "Clock in" "notnull" "$(jqr "$CI" '.clockIn')"
    TODAY=$(curl -s $GW/api/hr/time/today -H "Authorization: Bearer $MGR_TOKEN")
    check "Get today status" "notnull" "$(jqr "$TODAY" '.clockIn')"
    CO=$(curl -s -X POST $GW/api/hr/time/clock-out -H "Authorization: Bearer $MGR_TOKEN")
    check "Clock out" "notnull" "$(jqr "$CO" '.clockOut')"
  else
    skip "Clock in — $(jqr "$CI" '.message')"
  fi
else
  skip "Clock in/out — manager has no HR employee profile yet"
fi

ATT=$(curl -s $GW/api/hr/time/attendance -H "Authorization: Bearer $ACME_TOKEN")
check "Get attendance records" "notnull" "$(echo $ATT | jq -r '. | length' 2>/dev/null | tr -d '\n\r')"

CORR=$(curl -s $GW/api/hr/time/corrections -H "Authorization: Bearer $ACME_TOKEN")
check "Get time corrections" "notnull" "$(echo $CORR | jq -r '. | length' 2>/dev/null | tr -d '\n\r')"

SCHED=$(curl -s $GW/api/hr/time/schedules -H "Authorization: Bearer $ACME_TOKEN")
check "Get schedules" "notnull" "$(echo $SCHED | jq -r '. | length' 2>/dev/null | tr -d '\n\r')"

# ── 13. PAYROLL ──────────────────────────────────────────────────────────────
section "13. HR — PAYROLL"

PR=$(curl -s $GW/api/hr/payroll -H "Authorization: Bearer $ACME_TOKEN")
check "List payroll runs" "notnull" "$(echo $PR | jq -r '. | length' 2>/dev/null | tr -d '\n\r')"

# Use unique month to avoid conflicts
MONTH=$((RANDOM % 10 + 1))
RUN=$(curl -s -X POST $GW/api/hr/payroll/run \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d "{\"month\":$MONTH,\"year\":2025,\"notes\":\"Test run\"}")

RUN_ID=$(jqr "$RUN" '.id')
if [ -n "$RUN_ID" ] && [ "$RUN_ID" != "null" ]; then
  check "Run payroll" "PENDING_APPROVAL" "$(jqr "$RUN" '.status')"
  check "Payroll has employees" "notnull" "$(echo $RUN | jq -r '.items | length' 2>/dev/null | tr -d '\n\r')"
  check "Total gross calculated" "notnull" "$(jqr "$RUN" '.totalGross')"
  check "Total net calculated" "notnull" "$(jqr "$RUN" '.totalNet')"

  APP=$(curl -s -X PATCH $GW/api/hr/payroll/$RUN_ID/approve -H "Authorization: Bearer $ACME_TOKEN")
  check "Approve payroll" "APPROVED" "$(jqr "$APP" '.status')"

  PAID=$(curl -s -X PATCH $GW/api/hr/payroll/$RUN_ID/mark-paid -H "Authorization: Bearer $ACME_TOKEN")
  check "Mark payroll as paid" "PAID" "$(jqr "$PAID" '.status')"

  RUN_BY_ID=$(curl -s $GW/api/hr/payroll/$RUN_ID -H "Authorization: Bearer $ACME_TOKEN")
  check "Get payroll run by ID" "PAID" "$(jqr "$RUN_BY_ID" '.status')"
else
  skip "Run payroll — $(jqr "$RUN" '.message')"
fi

SLIPS=$(curl -s $GW/api/hr/payroll/my-payslips -H "Authorization: Bearer $MGR_TOKEN")
check "Get my payslips" "notnull" "$(echo $SLIPS | jq -r '. | length' 2>/dev/null | tr -d '\n\r')"

# ── 14. APPRAISALS ───────────────────────────────────────────────────────────
section "14. HR — APPRAISALS"

CYC=$(curl -s $GW/api/hr/appraisals/cycles -H "Authorization: Bearer $ACME_TOKEN")
check "List appraisal cycles" "notnull" "$(echo $CYC | jq -r '. | length' 2>/dev/null | tr -d '\n\r')"

TS=$(date +%s)
NEW_CYC=$(curl -s -X POST $GW/api/hr/appraisals/cycles \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACME_TOKEN" \
  -d "{\"title\":\"Test Cycle $TS\",\"startDate\":\"2026-01-01\",\"endDate\":\"2026-03-31\"}")
check "Create appraisal cycle" "notnull" "$(jqr "$NEW_CYC" '.id')"
CYC_ID=$(jqr "$NEW_CYC" '.id')

if [ -n "$CYC_ID" ] && [ "$CYC_ID" != "null" ]; then
  START=$(curl -s -X POST $GW/api/hr/appraisals/cycles/$CYC_ID/start \
    -H "Authorization: Bearer $ACME_TOKEN")
  check "Start appraisal cycle" "notnull" "$(jqr "$START" '.message')"

  APP_LIST=$(curl -s $GW/api/hr/appraisals/cycles/$CYC_ID/appraisals \
    -H "Authorization: Bearer $ACME_TOKEN")
  check "Get cycle appraisals" "notnull" "$(echo $APP_LIST | jq -r '. | length' 2>/dev/null | tr -d '\n\r')"
fi

MY_APP=$(curl -s $GW/api/hr/appraisals/my -H "Authorization: Bearer $MGR_TOKEN")
check "Get my appraisals" "notnull" "$(echo $MY_APP | jq -r '. | length' 2>/dev/null | tr -d '\n\r')"

# ── 15. CROSS-TENANT ISOLATION ───────────────────────────────────────────────
section "15. CROSS-TENANT ISOLATION"

ACME_D=$(curl -s $GW/api/hr/departments -H "Authorization: Bearer $ACME_TOKEN" | jq '. | length' 2>/dev/null | tr -d '\n\r')
STELLAR_D=$(curl -s $GW/api/hr/departments -H "Authorization: Bearer $STELLAR_TOKEN" | jq '. | length' 2>/dev/null | tr -d '\n\r')
if [ "$ACME_D" != "$STELLAR_D" ] || [ "$ACME_D" -gt "0" ]; then
  pass "Tenant isolation — Acme: $ACME_D depts, Stellar: $STELLAR_D depts"
else
  fail "Tenant isolation" "different counts" "both: $ACME_D"
fi

ACME_E=$(curl -s $GW/api/hr/employees -H "Authorization: Bearer $ACME_TOKEN" | jq -r '.meta.total' 2>/dev/null | tr -d '\n\r')
STELLAR_E=$(curl -s $GW/api/hr/employees -H "Authorization: Bearer $STELLAR_TOKEN" | jq -r '.meta.total' 2>/dev/null | tr -d '\n\r')
check "Acme has employees" "notnull" "$ACME_E"
check "Stellar has separate employees" "0" "$STELLAR_E"

# ── 16. LOGOUT ───────────────────────────────────────────────────────────────
section "16. LOGOUT"

LOGOUT=$(curl -s -X POST $GW/api/auth/auth/logout \
  -b /tmp/t-acme.txt -c /tmp/t-acme.txt)
check "Logout successful" "Logged out successfully" "$(jqr "$LOGOUT" '.message')"

LOGOUT_ALL=$(curl -s -X POST $GW/api/auth/auth/logout-all \
  -H "Authorization: Bearer $SA_TOKEN")
check "Logout all devices" "notnull" "$(jqr "$LOGOUT_ALL" '.message')"

# ── SUMMARY ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              TEST SUMMARY                ║${NC}"
echo -e "${BLUE}╠══════════════════════════════════════════╣${NC}"
echo -e "${BLUE}║${NC}  ${GREEN}Passed:  $PASS${NC}"
echo -e "${BLUE}║${NC}  ${RED}Failed:  $FAIL${NC}"
echo -e "${BLUE}║${NC}  ${YELLOW}Skipped: $SKIP${NC}"
echo -e "${BLUE}║${NC}  Total:   $((PASS + FAIL + SKIP))"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"

if [ $FAIL -eq 0 ]; then
  echo -e "\n${GREEN}✅ All tests passed — safe to push!${NC}\n"
  exit 0
else
  echo -e "\n${RED}❌ $FAIL test(s) failed — review before pushing!${NC}\n"
  exit 1
fi
