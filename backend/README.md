# SecureFDR Backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload
Docs: http://localhost:8000/docs

The backend scans maturity alerts at startup and every 24 hours while it is
running. The in-process scheduler runs once per backend process; use one
backend worker when relying on the daily scan.
