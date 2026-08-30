export type Role = 'admin' | 'supervisor' | 'member';

export interface User {
  id: number;
  username: string;
  nom: string;
  prenom: string;
  photo: string | null;
  role: Role;
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
}

export type AlertKind = 'refused_plate' | 'unknown_face' | 'spoof_attempt';

/** Single source of truth for alert wording — three kinds is one too many for a
 *  ternary repeated in every template. */
export const ALERT_LABELS: Record<AlertKind, string> = {
  refused_plate: 'Plaque refusée',
  unknown_face: 'Visage inconnu',
  spoof_attempt: "Tentative d'usurpation",
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

export interface Stats {
  date: string;
  membres: number;
  presents: number;
  absents: number;
  retards: number;
  autorises: number;
  refuses: number;
  alertes_non_vues: number;
}

/** Django REST pagination. */
export interface Page<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
