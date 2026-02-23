import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/auth-form";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/boards");
  }

  return (
    <main className="auth-shell">
      <AuthForm mode="login" />
      <p className="mt-5 text-center text-sm text-[var(--text-muted)]">
        No account yet?{" "}
        <Link className="text-[var(--brand)] hover:underline" href="/register">
          Create one
        </Link>
      </p>
    </main>
  );
}
