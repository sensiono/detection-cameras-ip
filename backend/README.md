# Backend — Django REST + MySQL

Owns the database and every decision that depends on it. The AI service recognises;
this decides whether a plate may enter, whether a presence is late, and who is absent.

## Setup

```bash
python -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env        # then export the variables, or use direnv

# MySQL, if you do not have one running
docker run -d --name vision-mysql -e MYSQL_ROOT_PASSWORD=vision \
  -e MYSQL_DATABASE=vision -p 3306:3306 mysql:8

python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
python manage.py test
```

## The one token the cameras need

```bash
python manage.py shell -c "
from core.models import User
from rest_framework.authtoken.models import Token
u,_ = User.objects.get_or_create(username='ai-service')
print(Token.objects.get_or_create(user=u)[0].key)"
```

Put it in `../config.yaml` under `sink.token`. Dashboard users log in with JWT instead:
two mechanisms because they are two different things — one machine account that may only
post events, and humans with roles.

## API

| Method | Path | Who | What |
|---|---|---|---|
| POST | `/api/events/` | AI service (Token) | the only write path from the cameras |
| POST | `/api/auth/login/` | anyone | JWT access + refresh |
| GET | `/api/dashboard/` | supervisor+ | today's counters, one round trip |
| GET | `/api/attendance/` | supervisor+ | `?user=&from=&to=` |
| GET | `/api/logs/` | supervisor+ | `?statut=refuse&from=&to=` |
| GET/POST/PUT/DELETE | `/api/vehicles/` | admin writes, supervisor reads | the authorisation list |
| GET | `/api/users/` | admin writes, supervisor reads | `?role=member` |
| GET | `/api/alerts/`, POST `…/{id}/seen/` | supervisor+ | refusals and unknown faces |
| GET | `/api/reports/attendance.xlsx\|.pdf` | supervisor+ | `?from=&to=&absent=1` |

### Event payload

```json
{"kind": "attendance", "camera_id": "cam-entrance", "subject": "42",
 "confidence": 0.71, "at": "2026-08-29T08:12:04+00:00", "snapshot": "<base64 jpeg>"}
```

* `attendance` — `subject` is a `User.id`. First sighting of the day writes `check_in`,
  every later one moves `check_out`. Past `LATE_AFTER` the row is `late`.
* `access` — `subject` is a normalised plate. Unknown or `autorise=False` gives a
  refused `AccessLog` **and** an `Alert`.
* `unknown_face` — a confident face matching nobody. `subject` is empty.

`snapshot` is optional; without it the rows still write, they are just unverifiable.

## Data model

The four tables of § 9, plus `Alert` which the § 6 "alertes en temps réel" requirement
needs and the cahier forgot to name.

```
User ──┬─< Attendance      (one row per person per day)
       ├─< Vehicle ──< AccessLog
       └─ role: admin | supervisor | member

Alert  (standalone: a refusal or an unknown face has no owner by definition)
```

| Table | Clé | Champs qui portent la logique |
|---|---|---|
| `User` | `id` | `role`, `nom`, `prenom`, `photo` |
| `Attendance` | `(user, date)` unique | `check_in`, `check_out`, `statut`, `confidence`, `snapshot` |
| `Vehicle` | `plaque` unique, normalisée | `autorise`, `user`, `type` |
| `AccessLog` | — | `plaque`, `statut`, `confidence`, `snapshot` |
| `Alert` | — | `kind`, `message`, `seen` |

`User` is one table for everyone — the people the cameras recognise (`member`) and the
people who log into the dashboard (`admin`, `supervisor`). The cahier describes them as
one population; splitting them would mean two identity tables and a join on every event.

**Plates are stored normalised.** `core/plates.py::canonical` strips separators and
leading zeros, so `159 TN 0895`, `159-tn-895` and `159TN895` are one row. Canonicalisation
happens in `to_internal_value`, *before* DRF's uniqueness check — doing it in
`validate_plaque` lets a duplicate reach the database and return HTTP 500 instead of 400.

Unlike the AI service, the backend deliberately does **not** undo OCR confusions
(`O`→`0`, `I`→`1`). A human typing a plate into the dashboard means what they typed.

## What happens to an event

`core/ingest.py::handle_event` is the whole decision layer, and it is the only place
where the database is allowed to change an outcome:

```
POST /api/events/  (Token auth, machine account only)
  │
  ├─ kind=attendance ─ first sighting today → check_in, statut = present|late
  │                    later sighting       → check_out moves
  │
  ├─ kind=access ──── Vehicle.autorise ? AccessLog(autorise)
  │                                     : AccessLog(refuse) + Alert
  │
  ├─ kind=unknown_face ─ Alert
  └─ kind=spoof_attempt ─ Alert   (photo held up to the camera)
```

The AI service never decides whether a plate may enter. It reports what it saw and
the confidence; authorisation is a database question, so it is answered here. That
separation is what lets you revoke a vehicle without touching the cameras.

## Tests

```bash
python manage.py test          # 17 tests
```

They cover the parts that would fail silently: the check-in/check-out transition, the
late boundary, refusal-plus-alert, plate normalisation collisions, role permissions on
every endpoint, and that the machine token can post events but cannot read anything.

## Design notes

**Absence is computed, never stored.** A member with no `Attendance` row for a day is
absent. Storing it would mean a nightly job and a source of truth that drifts.

**Attendance and logs are read-only over REST.** They are written by cameras; a
correction is an admin action and belongs in `/admin/` where it is audited.

**Only embeddings live in the AI service, only identities live here.** Neither half
holds enough to reconstruct a face on its own — that is the concrete answer to the
"sécurité des données biométriques" requirement, and it is worth a paragraph in the
report along with the INPDP declaration (loi 2004-63) that biometric processing needs.
