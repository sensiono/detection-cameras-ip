import os
from django.core.management import call_command
from django.core.management.base import BaseCommand
from core.models import AccessLog, Alert, Attendance, AttendanceAudit, Camera, SystemSetting, User, Vehicle


class Command(BaseCommand):
    help = "Reset data to production state: keep only admin login and SORETRAK company settings."

    def handle(self, *args, **options):
        # 1. Clean local demonstration data
        AttendanceAudit.objects.all().delete()
        Attendance.objects.all().delete()
        AccessLog.objects.all().delete()
        Alert.objects.all().delete()
        Vehicle.objects.all().delete()
        Camera.objects.all().delete()
        User.objects.exclude(username="admin").delete()

        # 2. Ensure admin exists
        if not User.objects.filter(username="admin").exists():
            self.stdout.write("Loading admin fixture...")
            try:
                call_command("loaddata", "soretrak_data.json")
                self.stdout.write(self.style.SUCCESS("Loaded soretrak_data.json successfully."))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"Could not load fixture: {e}"))
        else:
            admin = User.objects.get(username="admin")
            admin.is_staff = True
            admin.is_superuser = True
            admin.is_active = True
            admin.role = "admin"
            admin.nom = "Admin"
            admin.prenom = "SORETRAK"
            admin.save()
            self.stdout.write("Admin user verified.")

        # 3. Ensure SORETRAK company settings
        SystemSetting.set("company_name", "SORETRAK", "Nom de l'entreprise")
        SystemSetting.set("late_after", "08:30", "Heure limite de pointage à l'heure")

        self.stdout.write(self.style.SUCCESS("Clean state ready: only admin login and SORETRAK company settings present."))
