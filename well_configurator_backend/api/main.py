from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.endpoints import router
from database.local_db import engine, Base
from data.seed import seed_db

app = FastAPI(title="Well Configurator Offline API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rejestracja endpointów
app.include_router(router, prefix="/api/v1")

@app.on_event("startup")
def startup_event():
    # Upewnienie się że baza istnieje i ma dane startowe
    # normalnie migracje w alembic, tutaj Base.metadata
    Base.metadata.create_all(bind=engine)
    seed_db()
    print("API started, local database prepared and seeded.")
