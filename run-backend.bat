cd backend
if not exist venv python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt
if not exist securefdr.db python seed.py
uvicorn app.main:app --reload
