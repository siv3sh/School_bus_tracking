"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInviteRequest } from "@/lib/api/auth";
import { acceptInviteSchema } from "@/lib/validators/forms";

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const form = useForm<z.infer<typeof acceptInviteSchema>>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accept invite</h1>
          <p className="mt-1 text-sm text-muted-foreground">Set a password to activate your account, then sign in.</p>
        </div>
        {!token ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            This invite link is missing a token.
          </p>
        ) : null}
        <form
          className="space-y-4"
          onSubmit={form.handleSubmit(async (values) => {
            try {
              await acceptInviteRequest(token, values.password);
              router.replace("/login?reason=accepted");
            } catch (error) {
              form.setError("password", {
                message: error instanceof Error ? error.message : "Could not accept invite",
              });
            }
          })}
        >
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
            {form.formState.errors.password ? (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword ? (
              <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" disabled={!token || form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saving…" : "Set password"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <AcceptInviteForm />
    </Suspense>
  );
}
