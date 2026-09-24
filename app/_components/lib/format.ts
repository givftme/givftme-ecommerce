export const naira = (n: number) => "₦" + n.toLocaleString("en-NG");

export const shortDate = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

export const longDate = (d: Date) =>
  d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
