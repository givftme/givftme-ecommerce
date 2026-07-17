import { LoginForm } from "@/app/(auth)/login/LoginForm";

const authErrors: Record<string, string> = {
  oauth: "Couldn't connect to Google. Please try again.",
  confirmation_failed: "Something went wrong. Please try again.",
};

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    redirect?: string | string[];
    error?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const error = getParam(params.error);

  return (
    <LoginForm
      redirectTo={getParam(params.redirect)}
      initialError={error ? authErrors[error] : undefined}
    />
  );
}
