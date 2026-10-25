#!/bin/bash
cd backend
[ -d venv ] || python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
[ -f securefdr.db ] || python seed.py
uvicorn app.main:app --reload
