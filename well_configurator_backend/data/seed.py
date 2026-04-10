from sqlalchemy.orm import Session
from database.tables import ProductModel
from database.local_db import engine, Base

def seed_db():
    Base.metadata.create_all(bind=engine)
    from database.local_db import SessionLocal
    db = SessionLocal()
    
    if db.query(ProductModel).first():
        print("Database already seeded.")
        return
        
    print("Seeding database with mock products...")
    
    products = [
        # Dennice DN1500
        {"id": "DDD-15-060", "name": "Dennica DN1500 H=600", "dn": 1500, "componentType": "dennica", "height": 600, "magazynKLB": 1},
        {"id": "DDD-15-100", "name": "Dennica DN1500 H=1000", "dn": 1500, "componentType": "dennica", "height": 1000, "magazynKLB": 1},
        
        # Dennice DN2000
        {"id": "DDD-20-110", "name": "Dennica DN2000 H=1100", "dn": 2000, "componentType": "dennica", "height": 1100, "magazynKLB": 1},
        
        # Kręgi DN1500
        {"id": "KDB-15-10-D", "name": "Krąg DN1500/1000", "dn": 1500, "componentType": "krag", "height": 1000, "formaStandardowaKLB": 1},
        {"id": "KDB-15-05-D", "name": "Krąg DN1500/500", "dn": 1500, "componentType": "krag", "height": 500, "formaStandardowaKLB": 1},
        {"id": "KDB-15-10-OT", "name": "Krąg DN1500/1000 OT", "dn": 1500, "componentType": "krag_ot", "height": 1000, "formaStandardowaKLB": 1},
        
        # Kręgi DN2000
        {"id": "KDB-20-10-D", "name": "Krąg DN2000/1000", "dn": 2000, "componentType": "krag", "height": 1000, "formaStandardowaKLB": 1},
        {"id": "KDB-20-05-D", "name": "Krąg DN2000/500", "dn": 2000, "componentType": "krag", "height": 500, "formaStandardowaKLB": 1},
        
        # Kręgi DN1000 (do redukcji i ogólne)
        {"id": "KDB-10-10-D", "name": "Krąg DN1000/1000", "dn": 1000, "componentType": "krag", "height": 1000, "formaStandardowaKLB": 1},
        {"id": "KDB-10-05-D", "name": "Krąg DN1000/500", "dn": 1000, "componentType": "krag", "height": 500, "formaStandardowaKLB": 1},
        {"id": "KDB-10-10-OT", "name": "Krąg DN1000/1000 OT", "dn": 1000, "componentType": "krag_ot", "height": 1000, "formaStandardowaKLB": 1},
        
        # Redukcje
        {"id": "PDR-15-10", "name": "Płyta redukcyjna DN1500/1000", "dn": 1500, "componentType": "plyta_redukcyjna", "height": 200, "magazynKLB": 1},
        {"id": "PDR-20-10", "name": "Płyta redukcyjna DN2000/1000", "dn": 2000, "componentType": "plyta_redukcyjna", "height": 200, "magazynKLB": 1},
        
        # Zakończenia DN1000
        {"id": "KON-10", "name": "Konus DN1000", "dn": 1000, "componentType": "konus", "height": 600, "magazynKLB": 1},
        {"id": "PDD-10", "name": "Płyta DIN DN1000", "dn": 1000, "componentType": "plyta_din", "height": 150, "magazynKLB": 1},
        {"id": "PZE-10", "name": "Płyta odciążająca DN1000", "dn": 1000, "componentType": "plyta_zamykajaca", "height": 200, "magazynKLB": 1},
        {"id": "PO-10", "name": "Pierścień odciążający DN1000", "dn": 1000, "componentType": "pierscien_odciazajacy", "height": 100, "magazynKLB": 1},
        
        # Zakończenia DN1500/DN2000
        {"id": "PDD-15", "name": "Płyta DIN DN1500", "dn": 1500, "componentType": "plyta_din", "height": 180, "magazynKLB": 1},
        {"id": "PDD-20", "name": "Płyta DIN DN2000", "dn": 2000, "componentType": "plyta_din", "height": 200, "magazynKLB": 1},
        
        # Przejścia
        {"id": "PRZ-200", "name": "Przejście szczelne (sztywne)", "dn": None, "componentType": "przejscie", "zapasDol": 300, "zapasGora": 300, "zapasDolMin": 150, "zapasGoraMin": 150, "magazynKLB": 1},
    ]

    for p in products:
        item = ProductModel(**p)
        db.add(item)
    
    db.commit()
    db.close()
    print("Seeding complete.")

if __name__ == "__main__":
    seed_db()
