'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Pencil, Trash2, X } from 'lucide-react';
import { api, ApiError } from '@/lib/api-client';

const COLOR_PRESETS = [
  '#1D9E75',
  '#2563EB',
  '#9333EA',
  '#DB2777',
  '#F59E0B',
  '#0EA5E9',
];

export interface Course {
  id: string;
  code: string | null;
  name: string;
  color: string;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

interface CoursesPanelProps {
  initialCourses: Course[];
}

export function CoursesPanel({ initialCourses }: CoursesPanelProps) {
  const router = useRouter();
  const [courses, setCourses] = useState(initialCourses);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [color, setColor] = useState(COLOR_PRESETS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setName('');
    setCode('');
    setColor(COLOR_PRESETS[0]);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      code: code.trim() || undefined,
      color,
    };
    if (!payload.name) return;

    try {
      const updated: Course = editingId
        ? await api.updateCourse(editingId, payload)
        : await api.createCourse(payload);
      setCourses((prev) =>
        editingId
          ? prev.map((c) => (c.id === editingId ? updated : c))
          : [updated, ...prev],
      );
      reset();
      toast.success(editingId ? 'Course updated' : 'Course added');
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Failed to save course');
    }
  };

  const startEdit = (c: Course) => {
    setEditingId(c.id);
    setName(c.name);
    setCode(c.code ?? '');
    setColor(c.color);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this course?')) return;
    try {
      await api.deleteCourse(id);
      setCourses((prev) => prev.filter((c) => c.id !== id));
      toast.success('Course deleted');
      startTransition(() => router.refresh());
    } catch {
      toast.error('Failed to delete');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Edit course' : 'Add course'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
              <div className="space-y-2">
                <Label htmlFor="course-name">Name</Label>
                <Input
                  id="course-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Discrete Mathematics"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course-code">Code</Label>
                <Input
                  id="course-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="MATH101"
                  maxLength={16}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setColor(preset)}
                    aria-label={`Select color ${preset}`}
                    className={`h-7 w-7 rounded-full border-2 transition ${
                      color === preset
                        ? 'border-foreground'
                        : 'border-transparent'
                    }`}
                    style={{ backgroundColor: preset }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={pending}>
                {editingId ? 'Save changes' : 'Add course'}
              </Button>
              {editingId && (
                <Button type="button" variant="ghost" onClick={reset}>
                  <X className="h-4 w-4" /> Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Your courses ({courses.length})
        </h2>
        {courses.length === 0 ? (
          <div className="rounded-sm brutal-border bg-card p-6">
            <p className="text-sm font-bold uppercase tracking-tight">
              No courses yet.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first one in the form above — it&apos;s how StudySync
              keeps your generations organised.
            </p>
          </div>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {courses.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-3"
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: c.color }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    {c.code && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {c.code}
                      </span>
                    )}
                    <span className="truncate font-medium">{c.name}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(c)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Edit course"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete course"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
