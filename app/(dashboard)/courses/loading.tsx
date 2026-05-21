import { Card, CardContent } from '@/components/ui/card';

export default function CoursesLoading() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="h-7 w-32 rounded-sm bg-muted brutal-border animate-pulse" />
        <div className="mt-2 h-4 w-64 rounded-sm bg-muted animate-pulse" />
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="h-4 w-20 rounded-sm bg-muted animate-pulse" />
          <div className="mt-3 h-9 w-full rounded-sm bg-muted animate-pulse" />
          <div className="mt-3 h-4 w-16 rounded-sm bg-muted animate-pulse" />
          <div className="mt-3 h-9 w-full rounded-sm bg-muted animate-pulse" />
          <div className="mt-4 flex gap-2">
            <div className="h-9 w-28 rounded-sm bg-muted animate-pulse" />
          </div>
        </CardContent>
      </Card>
      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <li
            key={i}
            className="h-14 rounded-sm brutal-border bg-muted animate-pulse"
          />
        ))}
      </ul>
    </div>
  );
}
