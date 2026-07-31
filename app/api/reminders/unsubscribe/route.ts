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
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const type = url.searchParams.get("type");

  if (!token || (type !== "owner" && type !== "invitee")) {
    return htmlPage("This unsubscribe link is invalid.", 400);
  }

  const supabase = createServiceClient();

  if (type === "owner") {
    const { error } = await supabase
      .from("reminders")
      .delete()
      .eq("reminder_type", "occasion_owner")
      .eq("sent", false)
      .or(`important_date_id.eq.${token},occasion_id.eq.${token}`);

    if (error) {
      return htmlPage("Couldn't process your unsubscribe request. Try again later.", 500);
    }

    return htmlPage("You've been unsubscribed from this reminder.", 200);
  }

  const { error: optOutError } = await supabase
    .from("wishlist_invites")
    .update({ reminder_opted_in: false })
    .eq("id", token);

  if (optOutError) {
    return htmlPage("Couldn't process your unsubscribe request. Try again later.", 500);
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
    console.error("Couldn't delete pending invitee reminders on unsubscribe.", deleteError);
    return htmlPage("Couldn't process your unsubscribe request. Try again later.", 500);
  }

  return htmlPage("You've been unsubscribed.", 200);
}
