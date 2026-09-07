const DEFAULT_MAX_SMS_LENGTH = 160;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi;

function normalizeSmsText(value: string | undefined): string {
  return (value ?? '').replace(URL_PATTERN, '').replace(/\s+/g, ' ').trim();
}

function truncateWithEllipsis(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  if (maxLength <= 3) {
    return '.'.repeat(Math.max(0, maxLength));
  }

  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

export function formatAnnouncementSms({
  companyName,
  title,
  body,
  maxLength = DEFAULT_MAX_SMS_LENGTH,
}: {
  companyName?: string;
  title: string;
  body: string;
  maxLength?: number;
}): string {
  const safeMaxLength = Math.max(0, maxLength);
  const normalizedCompany = normalizeSmsText(companyName) || 'WorkPhelo';
  const normalizedTitle = normalizeSmsText(title) || 'Announcement';
  const normalizedBody = normalizeSmsText(body);

  const prefix = `${normalizedCompany}: ${normalizedTitle}`;
  const separator = normalizedBody ? ' - ' : '';
  const fullMessage = `${prefix}${separator}${normalizedBody}`;

  if (fullMessage.length <= safeMaxLength) {
    return fullMessage;
  }

  const bodyBudget = safeMaxLength - prefix.length - separator.length;
  if (normalizedBody && bodyBudget > 0) {
    return `${prefix}${separator}${truncateWithEllipsis(
      normalizedBody,
      bodyBudget,
    )}`;
  }

  return truncateWithEllipsis(prefix, safeMaxLength);
}
