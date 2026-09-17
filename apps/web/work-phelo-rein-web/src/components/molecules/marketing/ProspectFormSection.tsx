interface Props {
  title: string;
  children: React.ReactNode;
}

export function ProspectFormSection({ title, children }: Props) {
  return (
    <div className="flex flex-col gap-4 py-8 border-b border-gray-100 last:border-b-0 md:grid md:grid-cols-[220px_1fr] md:gap-10">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest pt-1">{title}</p>
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">{children}</div>
    </div>
  );
}
