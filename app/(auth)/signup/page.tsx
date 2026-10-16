import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { withRedirect } from "@/lib/auth/redirect";

export const metadata = { title: "Create an account" };

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[]; redirect?: string | string[] }>;
}) {
  const params = await searchParams;
  const redirectTo = getParam(params.redirect);

  // Everyone picks an account type at /get-started first; only the individual
  // path lands here. The return path rides along so it survives the detour.
  if (getParam(params.type) !== "individual") {
    redirect(withRedirect("/get-started", redirectTo));
  }

  return <AuthForm mode="signup" redirectTo={redirectTo} />;
}
