import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import type { Profile, Task, TaskEvent } from './types';

export interface BoardData {
  tasks: Task[];
  profiles: Record<string, Profile>;
  events: TaskEvent[];
  loading: boolean;
  error: string | null;
  live: boolean;
  reload: () => Promise<void>;
}

/** Loads the board and keeps it live through Supabase Realtime. Subscribes once per signed-in user. */
export function useBoard(userId: string | null): BoardData {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const timer = useRef<number | null>(null);

  const loadTasks = useCallback(async () => {
    const { data, error: e } = await supabase.from('tasks').select('*').order('sort').order('code');
    if (e) throw e;
    setTasks((data ?? []) as Task[]);
  }, []);
  const loadProfiles = useCallback(async () => {
    const { data, error: e } = await supabase.from('profiles').select('*');
    if (e) throw e;
    const map: Record<string, Profile> = {};
    for (const p of (data ?? []) as Profile[]) map[p.id] = p;
    setProfiles(map);
  }, []);
  const loadEvents = useCallback(async () => {
    const { data, error: e } = await supabase.from('task_events').select('*').order('created_at', { ascending: false }).limit(300);
    if (e) throw e;
    setEvents((data ?? []) as TaskEvent[]);
  }, []);

  const reload = useCallback(async () => {
    try {
      setError(null);
      await Promise.all([loadTasks(), loadProfiles(), loadEvents()]);
    } catch (e) {
      setError((e as Error).message ?? 'Could not load the board.');
    } finally {
      setLoading(false);
    }
  }, [loadTasks, loadProfiles, loadEvents]);

  useEffect(() => {
    if (!userId) return;
    void reload();
    // Coalesce bursts of changes (a claim writes several rows) into one refetch per table.
    const pending = new Set<string>();
    const flush = () => {
      timer.current = null;
      const jobs: Promise<void>[] = [];
      if (pending.has('tasks')) jobs.push(loadTasks());
      if (pending.has('profiles')) jobs.push(loadProfiles());
      if (pending.has('task_events')) jobs.push(loadEvents());
      pending.clear();
      Promise.all(jobs).catch((e) => setError((e as Error).message));
    };
    const queue = (table: string) => {
      pending.add(table);
      if (timer.current == null) timer.current = window.setTimeout(flush, 250);
    };
    const channel = supabase
      .channel('board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => queue('tasks'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => queue('profiles'))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_events' }, () => queue('task_events'))
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    return () => {
      if (timer.current != null) window.clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [userId, reload, loadTasks, loadProfiles, loadEvents]);

  return { tasks, profiles, events, loading, error, live, reload };
}
