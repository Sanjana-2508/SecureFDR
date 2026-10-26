# SecureFDR Backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload
Docs: http://localhost:8000/docs

The backend scans maturity alerts at startup and every 24 hours while it is
running. The in-process scheduler runs once per backend process; use one
backend worker when relying on the daily scan.

Maturity alerts cover verified FDRs through the configured
`alert_days_first` window (60 days in the default seed) and overdue FDRs that
remain verified or matured. Daily scans use UTC calendar dates and deduplicate
alerts per recipient, FDR, and alert type.

Administrators can create user accounts at `POST /admin/users` and register
institutions at `POST /admin/institutions`. These endpoints are Admin-only;
institution accounts must be assigned to an existing institution.
