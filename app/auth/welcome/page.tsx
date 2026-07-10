import { WelcomeScreen } from "@/app/auth/welcome/WelcomeScreen";

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const params = await searchParams;

  return <WelcomeScreen redirectTo={getParam(params.redirect)} />;
}
