import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = { title: "Create an account | Givftme" };

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const params = await searchParams;

  return <AuthForm mode="signup" redirectTo={getParam(params.redirect)} />;
}
