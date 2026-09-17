interface Props {
  count: number;
  isActive: boolean;
}

export function BranchStatus({ count, isActive }: Props) {
  if (!isActive)
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">
        Inactive
      </span>
    );
  if (count === 0)
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        Empty
      </span>
    );
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
      Active
    </span>
  );
}

export function HeadOfficeTag() {
  return (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand/10 text-brand shrink-0">
      Head Office
    </span>
  );
}
