import requests
from sqlalchemy.orm import Session
from database.tables import ProductModel
import datetime

MASTER_URL = "http://localhost:8001/api/v1/sync"

class SyncManager:
    def __init__(self, db: Session):
        self.db = db

    def sync_pull(self):
        """
        Pobiera dane z Master Server (8001) i aktualizuje lokalną bazę
        """
        try:
            print(f"SyncManager: Pulling from {MASTER_URL}/pull...")
            response = requests.get(f"{MASTER_URL}/pull", timeout=5)
            response.raise_for_status()
            data = response.json()
            items = data.get("items", [])
            
            updated_count = 0
            for item in items:
                db_item = self.db.query(ProductModel).filter(ProductModel.id == item["id"]).first()
                if db_item:
                    # Prosta logika: nadpisz jeśli cena jest inna
                    if db_item.price != item["price"]:
                        db_item.price = item["price"]
                        db_item.name = item["name"]
                        db_item.updated_at = datetime.datetime.now()
                        updated_count += 1
                else:
                    # Nowy produkt z Mastera
                    new_item = ProductModel(
                        id=item["id"],
                        name=item["name"],
                        price=item["price"],
                        category=item.get("category", "rury"),
                        sync_status="synced"
                    )
                    self.db.add(new_item)
                    updated_count += 1
            
            self.db.commit()
            print(f"SyncManager: Pull complete. Updated {updated_count} items.")
            return {"status": "ok", "updated": updated_count}
        except Exception as e:
            print(f"SyncManager PULL Error: {e}")
            return {"status": "error", "message": str(e)}

    def sync_push(self):
        """
        Wysyła lokalne zmiany (sync_status != 'synced') do Master Server
        """
        try:
            pending_items = self.db.query(ProductModel).filter(ProductModel.sync_status != "synced").all()
            if not pending_items:
                return {"status": "ok", "message": "No pending changes"}

            # Przygotuj dane do wysyłki
            data_to_send = [
                {
                    "id": item.id,
                    "name": item.name,
                    "price": item.price,
                    "category": item.category,
                    "updated_at": item.updated_at.isoformat() if item.updated_at else None
                }
                for item in pending_items
            ]

            print(f"SyncManager: Pushing {len(data_to_send)} items to {MASTER_URL}/push...")
            response = requests.post(f"{MASTER_URL}/push", json=data_to_send, timeout=5)
            response.raise_for_status()

            # Jeśli sukces, oznacz jako zsynchronizowane
            for item in pending_items:
                item.sync_status = "synced"
            self.db.commit()

            return {"status": "ok", "message": f"Pushed {len(data_to_send)} items"}
        except Exception as e:
            print(f"SyncManager PUSH Error: {e}")
            return {"status": "error", "message": str(e)}
