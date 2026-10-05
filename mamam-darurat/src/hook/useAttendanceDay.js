import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { absensiClient } from '../lib/absensiClient';
import { loadAttendance } from '../features/payroll/attendanceProvider';
import { buildAttendanceBoard } from '../features/attendance/attendanceBoard';
import { toLocalDateString } from '../utils/formatters';

/**
 * useAttendanceDay — papan absensi satu hari, BACA-SAJA dari sistem absensi.
 * "Real time" = dibaca langsung tiap layar dibuka + diperbarui otomatis tiap
 * `pollMs` selama layar terbuka dan tab terlihat (tanpa langganan realtime,
 * supaya tidak ada state lokal yang bisa basi). Pembaruan berikutnya berjalan
 * diam-diam: daftar tidak berkedip jadi "memuat".
 */
export function useAttendanceDay({ date, attendanceClient = absensiClient, pollMs = 60000 }) {
  const [employees, setEmployees] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const alive = useRef(true);
  const configured = Boolean(attendanceClient);

  const reload = useCallback(async () => {
    try {
      const emps = await supabase.from('employees').select('id, name, role, status, external_id').order('name');
      if (emps.error) throw new Error(emps.error.message);
      const list = (emps.data || []).map(e => ({ id: e.id, name: e.name, role: e.role, status: e.status, externalId: e.external_id || null }));
      if (!alive.current) return;
      setEmployees(list);
      if (attendanceClient) {
        const result = await loadAttendance(attendanceClient, { start: date, end: date }, list);
        if (!alive.current) return;
        setData(result);
        setUpdatedAt(new Date());
      }
      setError(null);
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [date, attendanceClient]);

  useEffect(() => { alive.current = true; setLoading(true); reload(); return () => { alive.current = false; }; }, [reload]);

  useEffect(() => {
    if (!pollMs || !configured) return undefined;
    const id = setInterval(() => { if (document.visibilityState !== 'hidden') reload(); }, pollMs);
    return () => clearInterval(id);
  }, [pollMs, configured, reload]);

  const today = toLocalDateString();
  const board = useMemo(() => (data ? buildAttendanceBoard(employees, data.logs, date, today) : null), [employees, data, date, today]);

  return { configured, loading, error, board, info: data, updatedAt, reload };
}
