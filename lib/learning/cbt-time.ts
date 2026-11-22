const cbtTime = new Intl.DateTimeFormat("en-NG", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Lagos",
});

export function formatCbtTime(timestamp: string) {
  return cbtTime.format(new Date(timestamp));
}
