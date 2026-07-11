@echo off
set CSP_MODE=enforce
cd /d I:\GitHub\Oferty_PV
npx ts-node-dev --transpile-only ./server.ts
