"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Bus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin } from "@/lib/hooks/use-auth";
import { loginSchema } from "@/lib/validators/forms";

function reasonMessage(reason: string | null): string | null {
  if (reason === "invited") return "Invite must be accepted before signing in.";
  if (reason === "suspended") return "This account is suspended.";
  if (reason === "accepted") return "Password set. Sign in with your new credentials.";
  return null;
}

function LoginForm() {
  const searchParams = useSearchParams();
  const login = useLogin();
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const reason = reasonMessage(searchParams.get("reason"));
  const errorMessage =
    login.error instanceof Error
      ? login.error.message
      : login.isError
        ? "Could not sign in"
        : null;
  const mobileOnly = Boolean(login.error && "code" in login.error && login.error.code === "MOBILE_ONLY");

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between p-10">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary font-semibold">SB</div>
          <span className="text-lg font-semibold">School Bus Tracking</span>
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="text-4xl font-semibold tracking-tight">Operations console for schools and the platform.</h1>
          <p className="text-sidebar-foreground/70">
            Invite schools, watch live buses, and manage routes, drivers, and parents from one place.
          </p>
        </div>
        <p className="text-xs text-sidebar-foreground/50">For school offices and product operators.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="lg:hidden">
            <div className="mb-6 flex items-center gap-2 font-semibold">
              <Bus className="size-5 text-primary" />
              School Bus Console
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use your admin account. Drivers and parents use the mobile app.</p>
          </div>
          {reason ? (
            <p className="rounded-md border bg-accent px-3 py-2 text-sm text-accent-foreground">{reason}</p>
          ) : null}
          {mobileOnly ? (
            <p className="rounded-md border border-pending/40 bg-pending/10 px-3 py-2 text-sm">
              Please use the School Bus mobile app.
            </p>
          ) : errorMessage ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => login.mutate(values))}
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...form.register("email")} />
              {form.formState.errors.email ? (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" {...form.register("password")} />
              {form.formState.errors.password ? (
                <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" disabled={login.isPending}>
              {login.isPending ? "Signing in…" : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <LoginForm />
    </Suspense>
  );
}
