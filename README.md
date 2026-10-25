# SecureFDR (SIH26265 prototype)

## Run (two terminals)

### Terminal 1 - Backend
cd backend
python -m venv venv
venv\Scripts\activate          (Mac/Linux: source venv/bin/activate)
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload

### Terminal 2 - Frontend
cd frontend
npm install
npm run dev

Open http://localhost:5173
Demo password for all accounts: demo123
  sunrise@inst.in (institution) | officer1@aicte.in (officer) | admin@securefdr.in (admin)
