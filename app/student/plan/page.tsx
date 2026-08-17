import { redirect } from "next/navigation";

export default function RetiredStudentPlanPage() {
  redirect("/sign-in?notice=student-surface-retired");
}
