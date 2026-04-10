import sys
import logging
from typing import List
from database.tables import ProductModel
from api.schemas import WellConfigInput, TransitionInput, AvailableProduct
from configuration_generator.generator import ConfigurationGenerator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.local_db import Base

logging.basicConfig(level=logging.INFO)

def run_test():
    engine = create_engine('sqlite:///local_catalog.db')
    Session = sessionmaker(bind=engine)
    session = Session()

    products = session.query(ProductModel).all()

    config = WellConfigInput(
        dn=1000,
        target_height_mm=5000,
        transitions=[
            TransitionInput(id='PVC-G\u0142adkie-200', height_from_bottom_mm=0, dn=200),  # Invert 0
            TransitionInput(id='PVC-G\u0142adkie-400', height_from_bottom_mm=0, dn=400),  # Invert 0
            TransitionInput(id='PVC-G\u0142adkie-200', height_from_bottom_mm=1500, dn=200), # Invert 1500
        ],
        warehouse='KLB'
    )

    generator = ConfigurationGenerator(products, config)
    results = generator.generate()

    if results:
        res = results[0]
        print(f"RESULT SUCCESS: {res.is_valid}")
        print(f"STAGE: {res.stage}")
        print(f"TOTAL HEIGHT: {res.total_height_mm}")
        print("COMPONENTS:")
        for it in res.items:
            print(f"- {it.name} (H={it.height_mm}, OT={it.is_ot})")
        print("ERRORS/WARNINGS:")
        for err in res.errors:
            print(f"!! {err}")
    else:
        print("No results returned.")

    session.close()

if __name__ == '__main__':
    run_test()
