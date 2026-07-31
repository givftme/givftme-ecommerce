import { createServiceClient } from "@/lib/supabase/server";

function htmlPage(message: string, status: number) {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Gifvtme</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="font-family: Inter, Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #FAF7F2; color: #1A1A1A;">
    <p style="max-width: 320px; text-align: center; font-size: 16px;">${message}</p>
  </body>
</html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

function htmlConfirmationPage(requestUrl: string) {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Gifvtme</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body style="font-family: Inter, Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #FAF7F2; color: #1A1A1A;">
    <div style="max-width: 320px; text-align: center;">
      <p style="font-size: 16px; margin-bottom: 20px;">Please confirm that you want to unsubscribe from this reminder.</p>
      <form method="post" action="${requestUrl}">
        <button type="submit" style="border: 0; border-radius: 999px; background: #C50404; color: #ffffff; padding: 12px 20px; font-size: 16px; cursor: pointer;">Unsubscribe</button>
      </form>
    </div>
  </body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseUnsubscribeRequest(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const type = url.searchParams.get("type");
  return { token, type };
}

async function applyUnsubscribe(
  supabase: ReturnType<typeof createServiceClient>,
  token: string,
  type: string,
) {
  if (type === "owner") {
    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("reminder_type", "occasion_owner")
      .eq("sent", false)
      .or(`important_date_id.eq.${token},occasion_id.eq.${token}`);

    if (error) {
      return {
        ok: false,
        message: "Couldn't process your unsubscribe request. Try again later.",
        status: 500,
      };
    }

    return {
      ok: true,
      message: "You've been unsubscribed from this reminder.",
      status: 200,
    };
  }

  const { error: optOutError } = await supabase
    .from("wishlist_invites")
    .update({ reminder_opted_in: false })
    .eq("id", token);

  if (optOutError) {
    return {
      ok: false,
      message: "Couldn't process your unsubscribe request. Try again later.",
      status: 500,
    };
  }

  const { error: deleteError } = await supabase
    .from("reminders")
    .delete()
    .eq("reminder_type", "invitee")
    .eq("sent", false)
    .eq("invite_id", token);

  if (deleteError) {
    // reminder_opted_in is already false at this point, so no *new* reminders
    // will be scheduled, but any already-queued ones weren't removed — don't
    // tell the user they're fully unsubscribed when one may still arrive.
    console.error(
      "Couldn't delete pending invitee reminders on unsubscribe.",
      deleteError,
    );
    return {
      ok: false,
      message: "Couldn't process your unsubscribe request. Try again later.",
      status: 500,
    };
  }

  return { ok: true, message: "You've been unsubscribed.", status: 200 };
}

export async function GET(request: Request) {
  const { token, type } = parseUnsubscribeRequest(request);

  if (
    !token ||
    !UUID_PATTERN.test(token) ||
    (type !== "owner" && type !== "invitee")
  ) {
    return htmlPage("This unsubscribe link is invalid.", 400);
  }

  return htmlConfirmationPage(request.url);
}

export async function POST(request: Request) {
  const { token, type } = parseUnsubscribeRequest(request);

  if (
    !token ||
    !UUID_PATTERN.test(token) ||
    (type !== "owner" && type !== "invitee")
  ) {
    return htmlPage("This unsubscribe link is invalid.", 400);
  }

  const supabase = createServiceClient();
  const result = await applyUnsubscribe(supabase, token, type);

  if (!result.ok) {
    return htmlPage(result.message, result.status);
  }

  return htmlPage(result.message, result.status);
}
