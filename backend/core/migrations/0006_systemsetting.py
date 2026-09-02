from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0005_camera'),
    ]

    operations = [
        migrations.CreateModel(
            name='SystemSetting',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('key', models.CharField(db_index=True, max_length=64, unique=True)),
                ('value', models.CharField(max_length=255)),
                ('description', models.CharField(blank=True, max_length=255)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ('key',),
            },
        ),
    ]
