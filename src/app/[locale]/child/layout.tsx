import { QuickExit } from "@/components/quick-exit";

export default function ChildLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="child-area">
      <div className="child-area-tools"><QuickExit /></div>
      {children}
    </div>
  );
}
