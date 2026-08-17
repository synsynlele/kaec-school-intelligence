import { redirect } from "next/navigation";

export default function RetiredStudentAskPage() {
  redirect("/sign-in?notice=student-surface-retired");
}
