import { redirect } from "next/navigation";

export default function RetiredStudentKsiPage() {
  redirect("/sign-in?notice=student-surface-retired");
}
