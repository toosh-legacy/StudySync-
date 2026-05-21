import { Card, CardContent } from '@/components/ui/card';

export default function DashboardLoading() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="h-7 w-44 rounded-sm bg-muted brutal-border animate-pulse" />
        <div className="mt-2 h-4 w-32 rounded-sm bg-muted animate-pulse" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="h-3 w-24 rounded-sm bg-muted animate-pulse" />
              <div className="mt-3 h-7 w-16 rounded-sm bg-muted animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-8">
        <div className="mb-3 h-3 w-32 rounded-sm bg-muted animate-pulse" />
        <ul className="grid gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 p-3">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-20 rounded-sm bg-muted animate-pulse" />
                    <div className="h-5 w-16 rounded-sm bg-muted animate-pulse" />
                  </div>
                  <div className="h-3 w-24 rounded-sm bg-muted animate-pulse" />
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
