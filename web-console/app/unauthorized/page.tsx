import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Not authorized</h1>
        <p className="text-sm text-muted-foreground">
          This console is only for product admins and school admins, and you can only open pages for your own role.
        </p>
        <Button asChild>
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    </div>
  );
}
