import { redirect } from "next/navigation";

export default function RetiredStudentLearningPage() {
  redirect("/sign-in?notice=student-surface-retired");
}
