import os
from django.core.management import call_command
from django.core.management.base import BaseCommand
from core.models import SystemSetting, User


class Command(BaseCommand):
    help = "Seed initial SORETRAK data (users, cameras, company settings) if not already populated."

    def handle(self, *args, **options):
        # Check if admin already exists
        if not User.objects.filter(username="admin").exists():
            self.stdout.write("Loading initial data fixture...")
            try:
                call_command("loaddata", "soretrak_data.json")
                self.stdout.write(self.style.SUCCESS("Loaded soretrak_data.json successfully."))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f"Could not load fixture: {e}"))
        else:
            self.stdout.write("Admin user already exists. Skipping full fixture load.")

        # Ensure SORETRAK company name is set
        SystemSetting.set("company_name", "SORETRAK", "Nom de l'entreprise")
        if not SystemSetting.objects.filter(key="late_after").exists():
            SystemSetting.set("late_after", "08:30", "Heure limite de pointage à l'heure")

        self.stdout.write(self.style.SUCCESS("SORETRAK settings verified."))
