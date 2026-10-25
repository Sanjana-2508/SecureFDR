from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from .routers import auth, admin, fdrs

Base.metadata.create_all(bind=engine)

app = FastAPI(title="SecureFDR API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(fdrs.router)


@app.get("/")
def root():
    return {"app": "SecureFDR", "status": "running", "docs": "/docs"}
