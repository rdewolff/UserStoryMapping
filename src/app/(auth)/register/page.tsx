import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/lib/auth";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/boards");
  }

  return (
    <main className="auth-shell">
      <AuthForm mode="register" />
      <p className="mt-5 text-center text-sm text-[var(--text-muted)]">
        Already have an account?{" "}
        <Link className="text-[var(--brand)] hover:underline" href="/login">
          Sign in
        </Link>
      </p>
    </main>
  );
}
