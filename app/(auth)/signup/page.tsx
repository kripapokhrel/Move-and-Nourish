import { AuthForm } from "@/components/auth/AuthForm";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <AuthForm
      mode="signup"
      notice={reason === "account-missing" ? "That account no longer exists, so you've been signed out. Create a new one to start again." : undefined}
    />
  );
}
