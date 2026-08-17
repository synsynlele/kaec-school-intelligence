import { redirect } from "next/navigation";

export default function RetiredStudentJoinPage() {
  redirect("/sign-in?notice=student-surface-retired");
}
