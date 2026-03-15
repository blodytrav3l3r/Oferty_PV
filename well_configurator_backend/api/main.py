from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.endpoints import router
from api.endpoints import router

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
    print("API started, working in DIRECT COUCHDB MODE.")
