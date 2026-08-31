import os
from datetime import date, timedelta
from django.conf import settings
from django.core.management.base import BaseCommand
from core.models import AccessLog, Alert, Attendance, AttendanceAudit


class Command(BaseCommand):
    help = (
        "Purge biometric crops, plate crops, and security alert snapshots older than N days "
        "(INPDP Law 2004-63 & GDPR compliance) while preserving cryptographic SHA-256 audit hashes."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--days",
            type=int,
            default=getattr(settings, "SNAPSHOT_RETENTION_DAYS", 30),
            help="Purge snapshots older than this number of days (default: 30)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simulate the purge without deleting files or updating database rows",
        )

    def handle(self, *args, **options):
        days = options["days"]
        dry_run = options["dry_run"]
        cutoff = date.today() - timedelta(days=days)

        self.stdout.write(
            self.style.NOTICE(f"Purging biometric/plate snapshots older than {days} days (before {cutoff})... [dry_run={dry_run}]")
        )

        attendance_qs = Attendance.objects.filter(date__lt=cutoff).exclude(snapshot="").exclude(snapshot__isnull=True)
        audits_qs = AttendanceAudit.objects.filter(date__lt=cutoff).exclude(snapshot="").exclude(snapshot__isnull=True)
        access_qs = AccessLog.objects.filter(date__lt=cutoff).exclude(snapshot="").exclude(snapshot__isnull=True)
        alerts_qs = Alert.objects.filter(created_at__date__lt=cutoff).exclude(snapshot="").exclude(snapshot__isnull=True)

        counts = {
            "attendance": attendance_qs.count(),
            "audits": audits_qs.count(),
            "access": access_qs.count(),
            "alerts": alerts_qs.count(),
        }
        total_records = sum(counts.values())

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f"Dry run complete: {total_records} snapshot references eligible for purge:\n"
                    f"  - Attendance daily check-ins: {counts['attendance']}\n"
                    f"  - Passage audit captures: {counts['audits']}\n"
                    f"  - Vehicle gate logs: {counts['access']}\n"
                    f"  - Security alerts: {counts['alerts']}\n"
                    f"All cryptographic SHA-256 audit hashes and time records will remain intact."
                )
            )
            return

        deleted_files = 0

        def _purge_qs(qs, name: str):
            nonlocal deleted_files
            for item in qs:
                if item.snapshot:
                    try:
                        if os.path.isfile(item.snapshot.path):
                            os.remove(item.snapshot.path)
                            deleted_files += 1
                    except Exception as exc:
                        self.stderr.write(f"Could not remove file for {name} {item.id}: {exc}")
                    item.snapshot = None
                    item.save(update_fields=["snapshot"])

        _purge_qs(attendance_qs, "attendance")
        _purge_qs(audits_qs, "attendance_audit")
        _purge_qs(access_qs, "access_log")
        _purge_qs(alerts_qs, "alert")

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully purged {total_records} snapshots ({deleted_files} physical media files permanently unlinked from disk).\n"
                f"GDPR & INPDP retention policy applied. Audit trail hashes preserved."
            )
        )
