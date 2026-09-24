const ymd = (x: Date) =>
  x.getFullYear() +
  String(x.getMonth() + 1).padStart(2, "0") +
  String(x.getDate()).padStart(2, "0");

export interface CalendarEvent {
  name: string;
  occasion: string;
  date: Date;
  yearly: boolean;
}

/** Builds a one-event .ics with a 7-day alarm and downloads it. */
export function downloadIcs({ name, occasion, date, yearly }: CalendarEvent) {
  const end = new Date(date);
  end.setDate(end.getDate() + 1);
  const title =
    name + "’s " + (occasion === "Other" ? "day" : occasion.toLowerCase());

  let lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Givtme//EN",
    "BEGIN:VEVENT",
    "UID:" + Date.now() + "@givtme",
    "DTSTAMP:" +
      new Date().toISOString().replace(/[-:]/g, "").split(".")[0] +
      "Z",
    "DTSTART;VALUE=DATE:" + ymd(date),
    "DTEND;VALUE=DATE:" + ymd(end),
    "SUMMARY:" + title,
  ];
  if (yearly) lines.push("RRULE:FREQ=YEARLY");
  lines = lines.concat([
    "BEGIN:VALARM",
    "TRIGGER:-P7D",
    "ACTION:DISPLAY",
    "DESCRIPTION:" + title + " is in 7 days",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]);

  const url = URL.createObjectURL(
    new Blob([lines.join("\r\n")], { type: "text/calendar" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "givtme-" + name.replace(/\W+/g, "-").toLowerCase() + ".ics";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
