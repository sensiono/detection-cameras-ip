export type Role = 'admin' | 'supervisor' | 'member';

export interface User {
  id: number;
  username: string;
  email?: string;
  nom: string;
  prenom: string;
  photo: string | null;
  role: Role;
  is_active?: boolean;
}


export interface AttendanceAudit {
  id: number;
  attendance: number | null;
  user: number;
  user_name: string;
  date: string;
  heure: string;
  timestamp: string;
  event_type: 'check_in' | 'departure_update' | 'passage';
  camera_id: string;
  confidence: number;
  snapshot: string | null;
  audit_hash?: string;
}

export interface Attendance {
  id: number;
  user: number;
  user_name: string;
  date: string;
  check_in: string;
  check_out: string | null;
  statut: 'present' | 'late';
  camera_id: string;
  confidence: number;
  snapshot: string | null;
  audit_hash?: string;
  audits?: AttendanceAudit[];
}


export interface Vehicle {
  id?: number;
  plaque: string;
  proprietaire: string;
  type: 'bus' | 'car' | 'other';
  autorise: boolean;
  user: number | null;
}

export interface AccessLog {
  id: number;
  vehicle: number | null;
  plaque: string;
  date: string;
  heure: string;
  statut: 'autorise' | 'refuse';
  camera_id: string;
  confidence: number;
  snapshot: string | null;
  audit_hash?: string;
}

export type AlertKind = 'refused_plate' | 'unknown_face' | 'spoof_attempt' | 'signal_loss' | 'tamper_attempt';

/** Single source of truth for alert wording */
export const ALERT_LABELS: Record<AlertKind, string> = {
  refused_plate: 'Plaque refusée',
  unknown_face: 'Visage inconnu',
  spoof_attempt: "Tentative d'usurpation",
  signal_loss: 'Perte de signal vidéo',
  tamper_attempt: 'Obstruction / Sabotage',
};


export interface Alert {
  id: number;
  kind: AlertKind;
  message: string;
  camera_id: string;
  snapshot: string | null;
  created_at: string;
  seen: boolean;
}

export interface Camera {
  id?: number;
  cam_id: string;
  name: string;
  url: string;
  task: 'attendance' | 'anpr';
  enabled: boolean;
  location?: string;
  resolution?: string;
  fps?: number;
  created_at?: string;
}

export interface Stats {
  date: string;
  membres: number;
  presents: number;
  absents: number;
  retards: number;
  autorises: number;
  refuses: number;
  alertes_non_vues: number;
  active_cameras?: number;
}

/** Django REST pagination. */
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

