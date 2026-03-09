from sqlalchemy.orm import Session
from database.tables import ProductModel

class SyncManager:
    def __init__(self, db: Session):
        self.db = db

    def sync_up(self, local_changes: list[dict]):
        """
        Symulacja wysyłania zmian z lokalnej bazy do centralnej.
        W przypadku systemów offline-first, centralny serwer sprawdza wersje.
        """
        results = []
        for change in local_changes:
            # Last write wins lub konflikt
            db_item = self.db.query(ProductModel).filter(ProductModel.id == change['id']).first()
            if db_item:
                if change.get('updated_at') > db_item.updated_at:
                    # Akceptacja
                    for k, v in change.items():
                        setattr(db_item, k, v)
                    db_item.sync_status = 'synced'
                    results.append({"id": change['id'], "status": "synced"})
                else:
                    # Konflikt: Wersja w centrali jest nowsza
                    db_item.sync_status = 'conflict'
                    results.append({"id": change['id'], "status": "conflict"})
            else:
                # Nowy element
                new_item = ProductModel(**change)
                new_item.sync_status = 'synced'
                self.db.add(new_item)
                results.append({"id": change['id'], "status": "synced"})
                
        self.db.commit()
        return results

    def sync_down(self):
        """
        Symulacja pobierania zmian (np. uaktualnienie stanów magazynowych).
        """
        # Można tu zaimplementować zwrot rekordów, gdzie 'updated_at' > ostatni 'sync_time' z klienta
        # Na potrzeby demonstracji pobieramy wszystkie z `sync_status == synced`
        return self.db.query(ProductModel).filter(ProductModel.sync_status == "synced").all()
