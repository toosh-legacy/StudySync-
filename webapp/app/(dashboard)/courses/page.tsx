import { api } from '@/lib/api-client.server';
import { CoursesPanel, type Course } from '@/components/dashboard/CoursesPanel';

export const dynamic = 'force-dynamic';

export default async function CoursesPage() {
  let courses: Course[] = [];
  try {
    courses = await api.listCourses();
  } catch {
    courses = [];
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-black uppercase tracking-tight">Courses</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add the courses you want to generate study material for.
        </p>
      </div>
      <CoursesPanel initialCourses={courses} />
    </div>
  );
}
