import { redirect } from "next/navigation";

export default function RetiredStudentMasteryPage() {
  redirect("/sign-in?notice=student-surface-retired");
}
