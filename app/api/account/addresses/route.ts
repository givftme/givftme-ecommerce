import { GET as getAddresses, POST as createAddress } from "@/app/api/addresses/route";

export async function GET(_request: Request) {
  return getAddresses();
}

export async function POST(request: Request) {
  return createAddress(request);
}
