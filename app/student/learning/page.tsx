import { StudentCurriculumLibraryPanel } from "@/components/student/student-curriculum-library-panel";
import { StudentLearningLibrary } from "@/components/student/student-learning-library";

export default function StudentLearningPage() {
  return (
    <>
      <StudentLearningLibrary />
      <StudentCurriculumLibraryPanel />
    </>
  );
}
