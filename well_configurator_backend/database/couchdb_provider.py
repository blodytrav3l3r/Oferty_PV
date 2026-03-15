import os
import requests
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

class CouchDBProvider:
    def __init__(self):
        self.url = os.getenv("COUCHDB_URL")
        self.db_prefix = os.getenv("PV_DB_PREFIX", "pv_")
        
    def get_studnia_products(self) -> List[Dict[str, Any]]:
        """
        Pobiera wszystkie produkty typu 'studnia' bezpośrednio z CouchDB.
        """
        try:
            db_name = f"{self.db_prefix}products"
            # W CouchDB produkty studni mają category='studnie' lub specyficzny componentType
            query = {
                "selector": {
                    "type": "product",
                    "category": "studnie"
                },
                "limit": 1000
            }
            
            response = requests.post(f"{self.url}/{db_name}/_find", json=query, timeout=10)
            if response.status_code == 200:
                docs = response.json().get("docs", [])
                # Mapowanie dokumentów CouchDB (_id -> id)
                for doc in docs:
                    if "_id" in doc:
                        doc["id"] = doc["_id"]
                return docs
            else:
                print(f"[COUCHDB ERROR] Status: {response.status_code}, {response.text}")
                return []
        except Exception as e:
            print(f"[COUCHDB EXCEPTION] {str(e)}")
            return []
