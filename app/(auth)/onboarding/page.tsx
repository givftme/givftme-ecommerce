import { OnboardingSlider } from "@/components/auth/OnboardingSlider";

function getParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string | string[] }>;
}) {
  const params = await searchParams;

  return <OnboardingSlider redirectTo={getParam(params.redirect)} />;
}
