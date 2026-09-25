import { Injectable, computed, signal } from '@angular/core';

export type Lang = 'fr' | 'en' | 'ar';

export interface Translations {
  [key: string]: {
    fr: string;
    en: string;
    ar: string;
  };
}

export const DICT: Translations = {
  // Navigation
  'nav.brand': { fr: 'SafeWatch', en: 'SafeWatch', ar: 'سيف ووتش' },
  'nav.brand_sub': { fr: 'Surveillance intelligente', en: 'Intelligent Surveillance', ar: 'مراقبة ذكية' },
  'nav.dashboard': { fr: 'Tableau de bord', en: 'Dashboard', ar: 'لوحة القيادة' },
  'nav.cameras': { fr: 'Caméras', en: 'Cameras', ar: 'الكاميرات' },
  'nav.attendance': { fr: 'Présences', en: 'Attendance', ar: 'الحضور' },
  'nav.recordings': { fr: 'Enregistrements', en: 'Recordings', ar: 'التسجيلات' },
  'nav.logs': { fr: 'Entrées / sorties', en: 'Gate Access', ar: 'حركة الدخول' },
  'nav.events': { fr: 'Événements', en: 'Events', ar: 'الأحداث' },
  'nav.vehicles': { fr: 'Véhicules', en: 'Vehicles', ar: 'المركبات' },
  'nav.members': { fr: 'Collaborateurs', en: 'Collaborators', ar: 'الموظفون' },
  'nav.users': { fr: 'Utilisateurs', en: 'Users', ar: 'المستخدمون' },
  'nav.alerts': { fr: 'Alertes', en: 'Alerts', ar: 'التنبيهات' },
  'nav.reports': { fr: 'Rapports', en: 'Reports', ar: 'التقارير' },
  'nav.settings': { fr: 'Paramètres', en: 'Settings', ar: 'الإعدادات' },
  'nav.logout': { fr: 'Déconnexion', en: 'Logout', ar: 'تسجيل الخروج' },
  'nav.live_cams': { fr: 'Caméras Actives', en: 'Active Cameras', ar: 'الكاميرات النشطة' },
  'nav.theme_toggle': { fr: 'Basculer le thème', en: 'Toggle theme', ar: 'تبديل المظهر' },
  'nav.lang_select': { fr: 'Langue', en: 'Language', ar: 'اللغة' },

  // Common UI
  'common.live': { fr: 'Direct', en: 'Live', ar: 'مباشر' },
  'common.search': { fr: 'Recherche rapide', en: 'Quick Search', ar: 'بحث سريع' },
  'common.quick_search': { fr: 'Recherche rapide', en: 'Quick Search', ar: 'بحث سريع' },
  'common.search_placeholder': { fr: 'Nom, caméra, statut...', en: 'Name, camera, status...', ar: 'الاسم، الكاميرا، الحالة...' },

  'common.reset': { fr: 'Réinitialiser', en: 'Reset', ar: 'إعادة ضبط' },
  'common.shortcuts': { fr: 'Raccourcis :', en: 'Shortcuts:', ar: 'اختصارات :' },
  'common.today': { fr: "Aujourd'hui", en: 'Today', ar: 'اليوم' },
  'common.this_month': { fr: 'Ce mois-ci', en: 'This month', ar: 'هذا الشهر' },
  'common.this_year': { fr: 'Cette année', en: 'This year', ar: 'هذه السنة' },
  'common.all': { fr: 'Tout', en: 'All', ar: 'الكل' },
  'common.year': { fr: 'Année', en: 'Year', ar: 'السنة' },
  'common.month': { fr: 'Mois', en: 'Month', ar: 'الشهر' },
  'common.day': { fr: 'Jour', en: 'Day', ar: 'اليوم' },
  'common.status': { fr: 'Statut', en: 'Status', ar: 'الحالة' },
  'common.all_status': { fr: 'Tous', en: 'All', ar: 'الكل' },
  'common.export_excel': { fr: 'Export Excel', en: 'Export Excel', ar: 'تصدير إكسيل' },
  'common.export_pdf': { fr: 'Rapport PDF', en: 'PDF Report', ar: 'تقرير PDF' },
  'common.previous': { fr: '← Précédent', en: '← Previous', ar: '← السابق' },
  'common.next': { fr: 'Suivant →', en: 'Next →', ar: 'التالي →' },
  'common.rows_per_page': { fr: 'Lignes par page :', en: 'Rows per page:', ar: 'الأسطر لكل صفحة :' },
  'common.page': { fr: 'Page', en: 'Page', ar: 'الصفحة' },
  'common.displaying': { fr: 'Affichage de', en: 'Showing', ar: 'عرض' },
  'common.of': { fr: 'sur', en: 'of', ar: 'من' },
  'common.records': { fr: 'enregistrement(s)', en: 'record(s)', ar: 'سجل' },
  'common.no_results': { fr: 'Aucun résultat pour ces critères', en: 'No results found', ar: 'لا توجد نتائج مطابقة' },
  'common.no_results_sub': { fr: 'Essayez de modifier les filtres ou cliquez sur réinitialiser.', en: 'Try adjusting filters or click reset.', ar: 'جرب تعديل خيارات التصفية أو اضغط إعادة ضبط.' },
  'common.clear_filters': { fr: 'Effacer les filtres', en: 'Clear filters', ar: 'مسح الفلاتر' },
  'common.date': { fr: 'Date', en: 'Date', ar: 'التاريخ' },
  'common.time': { fr: 'Heure', en: 'Time', ar: 'الوقت' },
  'common.camera': { fr: 'Caméra', en: 'Camera', ar: 'الكاميرا' },
  'common.score': { fr: 'Score', en: 'Score', ar: 'نسبة الدقة' },
  'common.capture': { fr: 'Capture', en: 'Snapshot', ar: 'صورة الالتقاط' },
  'common.actions': { fr: 'Actions', en: 'Actions', ar: 'الإجراءات' },
  'common.close': { fr: 'Fermer', en: 'Close', ar: 'إغلاق' },
  'common.save': { fr: 'Enregistrer', en: 'Save', ar: 'حفظ' },
  'common.cancel': { fr: 'Annuler', en: 'Cancel', ar: 'إلغاء' },
  'common.delete': { fr: 'Supprimer', en: 'Delete', ar: 'حذف' },
  'common.confirm': { fr: 'Confirmer', en: 'Confirm', ar: 'تأكيد' },

  // Dashboard Page
  'dash.title': { fr: 'Tableau de bord', en: 'Dashboard', ar: 'لوحة القيادة' },
  'dash.subtitle': { fr: 'Bienvenue, Admin ! Voici un aperçu de votre système.', en: 'Welcome, Admin! Here is an overview of your system.', ar: 'مرحباً، المشرف! إليك نظرة عامة على نظامك.' },
  'dash.active_cams': { fr: 'Caméras actives', en: 'Active cameras', ar: 'الكاميرات النشطة' },
  'dash.all_online': { fr: 'Toutes en ligne', en: 'All online', ar: 'الكل متصل' },
  'dash.recordings': { fr: 'Enregistrements', en: 'Recordings', ar: 'التسجيلات' },
  'dash.recordings_card': { fr: 'Enregistrements', en: 'Recordings', ar: 'التسجيلات' },
  'dash.today': { fr: "Aujourd'hui", en: 'Today', ar: 'اليوم' },
  'dash.today_sub': { fr: "Aujourd'hui", en: 'Today', ar: 'اليوم' },
  'dash.alerts': { fr: 'Alertes', en: 'Alerts', ar: 'التنبيهات' },
  'dash.alerts_card': { fr: 'Alertes', en: 'Alerts', ar: 'التنبيهات' },
  'dash.unread': { fr: 'non lues', en: 'unread', ar: 'غير مقروءة' },
  'dash.unread_sub': { fr: 'Non lues', en: 'Unread', ar: 'غير مقروءة' },
  'dash.users': { fr: 'Utilisateurs', en: 'Users', ar: 'المستخدمون' },
  'dash.users_card': { fr: 'Utilisateurs', en: 'Users', ar: 'المستخدمون' },
  'dash.active': { fr: 'Actifs', en: 'Active', ar: 'نشط' },
  'dash.active_sub': { fr: 'Actifs', en: 'Active', ar: 'نشط' },
  'dash.chart_activity': { fr: 'Activité des caméras', en: 'Camera activity', ar: 'نشاط الكاميرات' },
  'dash.cam_activity': { fr: 'Activité des caméras', en: 'Camera activity', ar: 'نشاط الكاميرات' },
  'dash.cams_online': { fr: 'Caméras en ligne', en: 'Cameras online', ar: 'الكاميرات المتصلة' },
  'dash.cams_online_legend': { fr: 'Caméras en ligne', en: 'Cameras online', ar: 'الكاميرات المتصلة' },
  'dash.chart_events': { fr: 'Répartition des événements', en: 'Event breakdown', ar: 'توزيع الأحداث' },
  'dash.event_distribution': { fr: 'Répartition des événements', en: 'Event breakdown', ar: 'توزيع الأحداث' },
  'dash.ev_motion': { fr: 'Détection de mouvement', en: 'Motion detection', ar: 'كشف الحركة' },
  'dash.ev_intrusion': { fr: 'Intrusion', en: 'Intrusion', ar: 'اقتحام' },
  'dash.ev_abandoned': { fr: 'Objet abandonné', en: 'Abandoned object', ar: 'جسم متروك' },
  'dash.ev_other': { fr: 'Autres', en: 'Others', ar: 'أخرى' },
  'dash.total_label': { fr: 'Total', en: 'Total', ar: 'المجموع' },
  'dash.live_cameras': { fr: 'Caméras en direct', en: 'Live cameras', ar: 'الكاميرات المباشرة' },
  'dash.live_cams_header': { fr: 'Caméras en direct', en: 'Live cameras', ar: 'الكاميرات المباشرة' },
  'dash.all_alerts': { fr: 'Voir toutes les alertes', en: 'View all alerts', ar: 'عرض جميع التنبيهات' },
  'dash.no_alerts': { fr: 'Aucune alerte enregistrée', en: 'No alerts recorded', ar: 'لا توجد تنبيهات مسجلة' },
  'dash.edit_camera': { fr: 'Modifier', en: 'Update', ar: 'تعديل' },
  'dash.delete_camera': { fr: 'Supprimer', en: 'Remove', ar: 'حذف' },
  'dash.present_today': { fr: 'Présents du jour', en: 'Present Today', ar: 'الحاضرون اليوم' },
  'dash.late_today': { fr: 'En retard', en: 'Late Arrivals', ar: 'المتأخرون' },
  'dash.absent_today': { fr: 'Absents estimés', en: 'Estimated Absentees', ar: 'الغيابات التقديرية' },
  'dash.auth_vehicles': { fr: 'Véhicules autorisés', en: 'Authorized Vehicles', ar: 'المركبات المصرح لها' },
  'dash.refused_vehicles': { fr: 'Véhicules refusés', en: 'Refused Vehicles', ar: 'المركبات المرفوضة' },
  'dash.unseen_alerts': { fr: 'Alertes non traitées', en: 'Unread Alerts', ar: 'تنبيهات غير مقروءة' },
  'dash.stream_cams': { fr: 'Caméras de Surveillance (Direct RTSP)', en: 'Surveillance Cameras (Live RTSP)', ar: 'كاميرات المراقبة (بث مباشر)' },
  'dash.fps': { fr: 'IPS (FPS)', en: 'FPS', ar: 'إطار/ث' },
  'dash.resolution': { fr: 'Résolution', en: 'Resolution', ar: 'الدقة' },
  'dash.ai_status': { fr: 'Moteur IA', en: 'AI Engine', ar: 'محرك الذكاء الاصطناعي' },
  'dash.online': { fr: 'En ligne', en: 'Online', ar: 'متصل' },
  'dash.offline': { fr: 'Hors ligne', en: 'Offline', ar: 'غير متصل' },
  'dash.quick_attendance': { fr: 'Derniers Pointages Présences', en: 'Recent Check-ins', ar: 'أحدث تسجيلات الحضور' },
  'dash.quick_access': { fr: 'Derniers Passages Véhicules (LAPI)', en: 'Recent Vehicle Gate Passes', ar: 'أحدث قراءات اللوحات' },
  'dash.see_all': { fr: 'Tout voir →', en: 'View all →', ar: 'عرض الكل ←' },
  'dash.live_modal_title': { fr: 'Flux Vidéo en Direct', en: 'Live Camera Stream', ar: 'البث المباشر للكاميرا' },

  // Attendance Page
  'att.title': { fr: 'Registre des Présences', en: 'Attendance Registry', ar: 'سجل الحضور والانصراف' },
  'att.subtitle': { fr: 'Pointage biométrique automatique, audit des départs et suivi des flux collaborateurs', en: 'Automated biometric check-in, departure audit & staff tracking', ar: 'تسجيل الحضور البيومتري الذكي، تدقيق الانصراف ومتابعة الموظفين' },
  'att.all_tab': { fr: 'Tous les enregistrements', en: 'All Records', ar: 'كافة السجلات' },
  'att.today_tab': { fr: "Aujourd'hui", en: 'Today', ar: 'اليوم' },
  'att.history_tab': { fr: 'Historique précédent', en: 'Previous History', ar: 'السجل السابق' },
  'att.collaborator': { fr: 'Collaborateur', en: 'Collaborator', ar: 'الموظف' },
  'att.check_in': { fr: 'Arrivée (Check-in)', en: 'Arrival (Check-in)', ar: 'الوصول (Check-in)' },
  'att.check_out': { fr: 'Départ (Check-out)', en: 'Departure (Check-out)', ar: 'الانصراف (Check-out)' },
  'att.audit_captures': { fr: 'Audit Passages', en: 'Passage Audit', ar: 'سجل التدقيق' },
  'att.captures_count': { fr: 'capture(s)', en: 'capture(s)', ar: 'لقطة' },
  'att.present': { fr: 'Présent', en: 'Present', ar: 'حاضر' },
  'att.late': { fr: 'En retard', en: 'Late', ar: 'متأخر' },
  'att.all_members': { fr: 'Tous les membres', en: 'All Members', ar: 'جميع الأعضاء' },
  'att.drawer_title': { fr: 'Fiche Collaborateur & Audit', en: 'Collaborator Profile & Audit', ar: 'بطاقة الموظف وسجل التدقيق' },
  'att.drawer_subtitle': { fr: 'Historique des pointages et captures biométriques', en: 'Check-in history and biometric captures', ar: 'سجل الحركات ولقطات التعرف على الوجه' },
  'att.enrolled_member': { fr: 'Membre Enrôlé (ArcFace 512-d)', en: 'Enrolled Member (ArcFace 512-d)', ar: 'عضو مسجل (بصمة وجه 512-d)' },
  'att.total_checkins': { fr: 'Pointages', en: 'Check-ins', ar: 'مرات الحضور' },
  'att.on_time': { fr: "À l'heure", en: 'On Time', ar: 'في الموعد' },
  'att.lates': { fr: 'Retards', en: 'Lates', ar: 'مرات التأخير' },
  'att.punctuality': { fr: 'Ponctualité', en: 'Punctuality', ar: 'نسبة الانضباط' },
  'att.timeline_title': { fr: "Journal d'Audit des Passages (Timeline)", en: 'Passage Audit Trail (Timeline)', ar: 'الشريط الزمني لحركات المرور' },
  'att.history_summary': { fr: 'Historique Journalier Consolidé', en: 'Consolidated Daily History', ar: 'السجل اليومي المجمع' },
  'att.departure_update': { fr: 'Mise à jour départ', en: 'Departure Update', ar: 'تحديث الانصراف' },
  'att.this_record': { fr: 'Ce pointage', en: 'This record', ar: 'هذا اليوم' },
  'att.all_history': { fr: "Tout l'historique", en: 'All history', ar: 'كامل السجل' },
  'att.click_to_view_day': { fr: 'Cliquer pour filtrer les captures', en: 'Click to filter captures', ar: 'انقر لتصفية اللقطات' },
  'att.config_schedule': { fr: 'Horaire de pointage', en: 'Work Schedule', ar: 'توقيت الحضور' },
  'att.late_threshold': { fr: "Heure limite d'arrivée", en: 'Late Cutoff Time', ar: 'التوقيت الأقصى للحضور' },
  'att.late_threshold_desc': {
    fr: "Tout pointage après cette heure est automatiquement qualifié 'En retard'.",
    en: "Any check-in after this time is automatically marked as 'Late'.",
    ar: 'أي تسجيل حضور بعد هذا التوقيت يعتبر تأخيراً آلياً.'
  },
  'att.schedule_saved': {
    fr: 'Horaire de pointage mis à jour avec succès.',
    en: 'Work schedule updated successfully.',
    ar: 'تم تحديث توقيت الحضور بنجاح.'
  },


  // Access Logs Page
  'logs.title': { fr: 'Journal des Accès Véhicules (ANPR)', en: 'Vehicle Access Logs (ANPR)', ar: 'سجل دخول وخروج المركبات' },
  'logs.subtitle': { fr: 'Reconnaissance optique des plaques d’immatriculation tunisiennes au portail', en: 'Automatic license plate recognition at the gate', ar: 'التعرف الآلي على لوحات السيارات عند البوابة' },
  'logs.plate': { fr: 'Immatriculation', en: 'License Plate', ar: 'رقم اللوحة' },
  'logs.authorized': { fr: 'Autorisé', en: 'Authorized', ar: 'مصرح به' },
  'logs.refused': { fr: 'Refusé', en: 'Refused', ar: 'مرفوض' },
  'logs.whitelist_btn': { fr: 'Autoriser', en: 'Whitelist', ar: 'ترخيص' },

  'logs.whitelisted_toast': { fr: 'Véhicule ajouté à la liste blanche', en: 'Vehicle added to whitelist', ar: 'تمت إضافة السيارة إلى القائمة البيضاء' },

  // Vehicles Page
  'veh.title': { fr: 'Liste Blanche des Véhicules', en: 'Vehicle Whitelist', ar: 'قائمة المركبات المصرح لها' },
  'veh.subtitle': { fr: 'Gestion des autorisations de franchissement de la barrière', en: 'Manage gate access permissions and vehicle whitelist', ar: 'إدارة أذونات العبور والقائمة البيضاء للمركبات' },
  'veh.add': { fr: 'Ajouter un véhicule', en: 'Add Vehicle', ar: 'إضافة مركبة' },
  'veh.owner': { fr: 'Propriétaire', en: 'Owner', ar: 'المالك' },
  'veh.type': { fr: 'Type', en: 'Type', ar: 'النوع' },
  'veh.access': { fr: 'Accès', en: 'Access', ar: 'الصلاحية' },
  'veh.car': { fr: 'Voiture', en: 'Car', ar: 'سيارة' },
  'veh.bus': { fr: 'Bus', en: 'Bus', ar: 'حافلة' },
  'veh.other': { fr: 'Autre', en: 'Other', ar: 'أخرى' },

  // Members Page
  'members.title': { fr: 'Gestion des Collaborateurs & Enrôlement Biométrique', en: 'Staff & Biometric Face Enrollment', ar: 'إدارة الموظفين والتسجيل البيومتري للوجوه' },
  'members.subtitle': { fr: 'Enrôlez les visages, gérez les profils et synchronisez l’index facial IA', en: 'Enroll face profiles, manage staff & sync AI ArcFace gallery', ar: 'تسجيل بصمات الوجوه، إدارة الملفات وتحديث قاعدة التعرف الذكية' },
  'members.add': { fr: 'Enrôler un collaborateur', en: 'Enroll Member', ar: 'تسجيل موظف جديد' },
  'members.firstname': { fr: 'Prénom', en: 'First Name', ar: 'الاسم' },
  'members.lastname': { fr: 'Nom', en: 'Last Name', ar: 'اللقب' },
  'members.matricule': { fr: 'Matricule / Identifiant', en: 'Employee ID / Username', ar: 'الرقم الوظيفي / اسم المستخدم' },
  'members.role': { fr: 'Rôle', en: 'Role', ar: 'الدور' },
  'members.role_member': { fr: 'Collaborateur (Suivi)', en: 'Staff Member', ar: 'موظف (تتبع الحضور)' },
  'members.role_supervisor': { fr: 'Superviseur', en: 'Supervisor', ar: 'مشرف' },
  'members.role_admin': { fr: 'Administrateur', en: 'Administrator', ar: 'مسؤول نظام' },
  'members.photo_drop': { fr: 'Cliquez ou glissez une ou plusieurs photos du visage (JPEG/PNG)', en: 'Click or drop one or multiple face photos (JPEG/PNG)', ar: 'اضغط أو اسحب صورة أو عدة صور للوجه (JPEG/PNG)' },
  'members.photo_hint': { fr: 'Plusieurs angles recommandés (face, légers profils) avec bonne luminosité', en: 'Multiple angles recommended (frontal, slight profiles) with good lighting', ar: 'يوصى بزوايا متعددة (وجه، جوانب خفيفة) مع إضاءة جيدة' },
  'members.photos_count': { fr: 'photo(s) enregistrée(s)', en: 'photo(s) enrolled', ar: 'صورة مسجلة' },
  'members.enrolled_badge': { fr: 'Visage Enrôlé (ArcFace)', en: 'Face Enrolled (ArcFace)', ar: 'بصمة مسجلة' },
  'members.no_photo_badge': { fr: 'Sans Photo', en: 'No Photo', ar: 'بدون صورة' },



  // Alerts Page
  'alerts.title': { fr: 'Centre des Alertes de Sécurité', en: 'Security Alerts Center', ar: 'مركز التنبيهات الأمنية' },
  'alerts.subtitle': { fr: 'Surveillance des anomalies : plaques refusées, visages inconnus et tentatives d’usurpation', en: 'Anomaly monitoring: refused plates, unknown faces, and anti-spoofing events', ar: 'متابعة الحوادث: اللوحات المرفوضة، الوجوه المجهولة ومحاولات الانتحال' },
  'alerts.mark_all_read': { fr: 'Tout marquer comme lu', en: 'Mark all as read', ar: 'تحديد الكل كمقروء' },
  'alerts.acknowledge': { fr: 'Acquitter', en: 'Acknowledge', ar: 'اعتماد' },
  'alerts.acknowledged': { fr: 'Traité', en: 'Resolved', ar: 'معتمد' },
  'alerts.kind_refused_plate': { fr: 'Plaque refusée', en: 'Refused Plate', ar: 'لوحة مرفوضة' },
  'alerts.kind_unknown_face': { fr: 'Visage inconnu', en: 'Unknown Face', ar: 'وجه غير معروف' },
  'alerts.kind_spoof_attempt': { fr: "Tentative d'usurpation", en: 'Spoof Attempt', ar: 'محاولة انتحال' },
  'alerts.kind_signal_loss': { fr: 'Perte de signal caméra', en: 'Camera Signal Loss', ar: 'انقطاع إشارة الكاميرا' },
  'alerts.kind_tamper_attempt': { fr: 'Obstruction / Sabotage caméra', en: 'Camera Tampering / Obstruction', ar: 'محاولة تخريب أو حجب الكاميرا' },


  // Login Page
  'login.title': { fr: 'Connexion Sécurisée', en: 'Secure Login', ar: 'تسجيل الدخول الآمن' },
  'login.subtitle': { fr: 'Accédez à la plateforme de surveillance VISION AI', en: 'Sign in to VISION AI surveillance platform', ar: 'الدخول إلى منصة المراقبة الذكية' },
  'login.username': { fr: "Nom d'utilisateur", en: 'Username', ar: 'اسم المستخدم' },
  'login.password': { fr: 'Mot de passe', en: 'Password', ar: 'كلمة المرور' },
  'login.submit': { fr: 'Se connecter', en: 'Sign In', ar: 'تسجيل الدخول' },
  'login.error': { fr: 'Identifiants invalides ou serveur indisponible', en: 'Invalid credentials or server unavailable', ar: 'بيانات الاعتماد غير صحيحة أو الخادم غير متاح' },

  'login.no_account': { fr: 'Pas de compte ?', en: 'No account?', ar: 'ليس لديك حساب؟' },
  'login.have_account': { fr: 'Déjà un compte ?', en: 'Already have an account?', ar: 'لديك حساب بالفعل؟' },
  'signup.link': { fr: 'Créer un compte', en: 'Create an account', ar: 'إنشاء حساب' },
  'signup.submit': { fr: "S'inscrire", en: 'Sign Up', ar: 'التسجيل' },
  'signup.email': { fr: 'E-mail', en: 'Email', ar: 'البريد الإلكتروني' },
  'signup.confirm': { fr: 'Confirmer le mot de passe', en: 'Confirm password', ar: 'تأكيد كلمة المرور' },
  'signup.mismatch': { fr: 'Les mots de passe ne correspondent pas', en: 'Passwords do not match', ar: 'كلمتا المرور غير متطابقتين' },
  'signup.error': { fr: "Échec de l'inscription", en: 'Sign up failed', ar: 'فشل التسجيل' },
  'signup.pending': { fr: "Compte créé. Un administrateur doit l'approuver avant la connexion.", en: 'Account created. An administrator must approve it before you can sign in.', ar: 'تم إنشاء الحساب. يجب أن يوافق عليه مسؤول قبل تسجيل الدخول.' },
  'members.pending': { fr: 'En attente', en: 'Pending', ar: 'قيد الانتظار' },
  'members.approve': { fr: 'Approuver', en: 'Approve', ar: 'موافقة' },

  // Settings & Profile Modal
  'settings.title': { fr: 'Paramètres du Compte & Système', en: 'Account & System Settings', ar: 'إعدادات الحساب والنظام' },
  'settings.tab_profile': { fr: 'Mon Profil', en: 'My Profile', ar: 'الملف الشخصي' },
  'settings.tab_security': { fr: 'Sécurité & Mot de passe', en: 'Security & Password', ar: 'الأمان وكلمة المرور' },
  'settings.tab_company': { fr: 'Paramètres Entreprise', en: 'Company Settings', ar: 'إعدادات المؤسسة' },
  'settings.username': { fr: "Nom d'utilisateur", en: 'Username', ar: 'اسم المستخدم' },
  'settings.email': { fr: 'Adresse e-mail', en: 'Email address', ar: 'البريد الإلكتروني' },
  'settings.firstname': { fr: 'Prénom', en: 'First name', ar: 'الاسم' },
  'settings.lastname': { fr: 'Nom', en: 'Last name', ar: 'اللقب' },
  'settings.role': { fr: 'Rôle dans le système', en: 'System role', ar: 'الدور في النظام' },
  'settings.old_password': { fr: 'Ancien mot de passe', en: 'Current password', ar: 'كلمة المرور الحالية' },
  'settings.new_password': { fr: 'Nouveau mot de passe', en: 'New password', ar: 'كلمة المرور الجديدة' },
  'settings.confirm_password': { fr: 'Confirmer le mot de passe', en: 'Confirm new password', ar: 'تأكيد كلمة المرور' },
  'settings.company_name': { fr: "Nom de l'entreprise", en: 'Company name', ar: 'اسم المؤسسة' },
  'settings.profile_saved': { fr: 'Profil mis à jour avec succès.', en: 'Profile updated successfully.', ar: 'تم تحديث الملف الشخصي بنجاح.' },
  'settings.password_saved': { fr: 'Mot de passe modifié avec succès.', en: 'Password changed successfully.', ar: 'تم تغيير كلمة المرور بنجاح.' },
  'settings.company_saved': { fr: 'Paramètres entreprise mis à jour.', en: 'Company settings updated.', ar: 'تم تحديث إعدادات المؤسسة.' },
  'settings.password_mismatch': { fr: 'Les mots de passe ne correspondent pas.', en: 'Passwords do not match.', ar: 'كلمات المرور غير متطابقة.' },
  'settings.save_profile': { fr: 'Mettre à jour le profil', en: 'Update Profile', ar: 'تحديث الملف الشخصي' },
  'settings.change_password': { fr: 'Changer le mot de passe', en: 'Change Password', ar: 'تغيير كلمة المرور' },
  'settings.save_company': { fr: 'Enregistrer les paramètres', en: 'Save Settings', ar: 'حفظ الإعدادات' },
};


@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly STORAGE_KEY = 'vision_ai_lang';
  
  readonly currentLang = signal<Lang>(this.loadSavedLang());

  readonly isRtl = computed(() => this.currentLang() === 'ar');

  readonly dict = computed(() => {
    const lang = this.currentLang();
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(DICT)) {
      result[key] = value[lang] || value['fr'];
    }
    return result;
  });

  constructor() {
    this.applyDocumentDirection(this.currentLang());
  }

  private loadSavedLang(): Lang {
    const saved = localStorage.getItem(this.STORAGE_KEY) as Lang;
    return saved === 'en' || saved === 'ar' ? saved : 'fr';
  }

  setLang(lang: Lang): void {
    this.currentLang.set(lang);
    localStorage.setItem(this.STORAGE_KEY, lang);
    this.applyDocumentDirection(lang);
  }

  t(key: string, fallback?: string): string {
    const lang = this.currentLang();
    const entry = DICT[key];
    if (!entry) return fallback || key;
    return entry[lang] || entry['fr'] || fallback || key;
  }

  private applyDocumentDirection(lang: Lang): void {
    const isRtl = lang === 'ar';
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    if (isRtl) {
      document.body.classList.add('rtl-mode');
    } else {
      document.body.classList.remove('rtl-mode');
    }
  }
}
