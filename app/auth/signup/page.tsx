import { SignupForm } from "@/app/auth/signup/SignupForm";

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const params = await searchParams;

  return <SignupForm redirectTo={getParam(params.redirect)} />;
}
