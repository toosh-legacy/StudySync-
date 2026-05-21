import { useEffect, useState } from 'react';
import { getCourses, createCourse } from '../lib/api';
import {
  getStorage,
  setStorage,
  type Course,
} from '../lib/storage';

const TEN_MIN = 10 * 60 * 1000;

export function useCourses() {
  const [courses, setCourses] = useState<Course[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await getStorage('courses_cache');
      const cachedAt = (await getStorage('courses_cached_at')) ?? 0;
      if (cached && Date.now() - cachedAt < TEN_MIN) {
        if (!cancelled) setCourses(cached);
        return;
      }
      try {
        const fresh = await getCourses();
        await setStorage({ courses_cache: fresh, courses_cached_at: Date.now() });
        if (!cancelled) setCourses(fresh);
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load courses');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addCourse = async (
    payload: { name: string; code?: string; color?: string },
  ): Promise<Course | null> => {
    try {
      const created = await createCourse(payload);
      setCourses((prev) => (prev ? [created, ...prev] : [created]));
      const updated = (await getStorage('courses_cache')) ?? [];
      await setStorage({
        courses_cache: [created, ...updated],
        courses_cached_at: Date.now(),
      });
      return created;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add course');
      return null;
    }
  };

  return { courses, error, addCourse };
}
