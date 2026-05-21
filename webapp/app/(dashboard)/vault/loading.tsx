import { Card, CardContent } from '@/components/ui/card';

export default function VaultLoading() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="h-7 w-24 rounded-sm bg-muted brutal-border animate-pulse" />
        <div className="mt-2 h-4 w-48 rounded-sm bg-muted animate-pulse" />
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <li key={i}>
            <Card>
              <CardContent className="p-4">
                <div className="flex gap-2">
                  <div className="h-5 w-20 rounded-sm bg-muted animate-pulse" />
                  <div className="h-5 w-16 rounded-sm bg-muted animate-pulse" />
                </div>
                <div className="mt-3 h-4 w-32 rounded-sm bg-muted animate-pulse" />
                <div className="mt-2 h-3 w-44 rounded-sm bg-muted animate-pulse" />
                <div className="mt-4 h-8 w-20 rounded-sm bg-muted animate-pulse" />
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
