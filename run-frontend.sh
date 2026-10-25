#!/bin/bash
cd frontend
[ -d node_modules ] || npm install
npm run dev
