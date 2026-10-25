# SecureFDR Backend
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload
Docs: http://localhost:8000/docs
