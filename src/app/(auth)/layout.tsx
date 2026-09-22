import Link from "next/link";

import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/" className="flex items-center justify-center">
          <Logo className="h-10 w-auto" />
        </Link>
        {children}
      </div>
    </div>
  );
}
