import os
import re
import json
import asyncio
import logging
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from database.local_db import SessionLocal
from database.tables import ProductModel

logger = logging.getLogger(__name__)

JS_FILE_PATH = r"g:\GitHub\Oferty_PV\public\js\pricelist_studnie.js"
POLL_INTERVAL = 3.0

def parse_js_pricelist() -> List[Dict[str, Any]]:
    if not os.path.exists(JS_FILE_PATH):
        logger.error(f"JS file not found: {JS_FILE_PATH}")
        return []
        
    try:
        with open(JS_FILE_PATH, 'r', encoding='utf-8') as f:
            text = f.read()
            
        start = text.find('const DEFAULT_PRODUCTS_STUDNIE')
        if start == -1:
            return []
        start = text.find('[', start)
        
        if start == -1:
            return []
            
        bracket_count = 0
        in_string = False
        escape = False
        end = -1
        
        for i in range(start, len(text)):
            char = text[i]
            
            if escape:
                escape = False
                continue
                
            if char == '\\':
                escape = True
                continue
                
            if char == '"':
                in_string = not in_string
                continue
                
            if not in_string:
                if char == '[':
                    bracket_count += 1
                elif char == ']':
                    bracket_count -= 1
                    if bracket_count == 0:
                        end = i + 1
                        break
                        
        if end != -1:
            array_str = text[start:end]
            try:
                data = json.loads(array_str)
                return data
            except json.JSONDecodeError as decode_err:
                logger.error(f"JSON Decode Error in JS file: {decode_err}")
                items = []
                raw_items = re.split(r'\},?\s*\{', array_str[1:-1])
                for it in raw_items:
                    it_clean = it.strip()
                    if not it_clean.startswith('{'):
                        it_clean = '{' + it_clean
                    if not it_clean.endswith('}'):
                        it_clean = it_clean + '}'
                    
                    it_clean = re.sub(r'([{,]\s*)([a-zA-Z_0-9]+)(\s*:)', r'\1"\2"\3', it_clean)
                    it_clean = it_clean.replace("'", '"')
                    it_clean = re.sub(r',\s*}', '}', it_clean)
                    try:
                        parsed = json.loads(it_clean)
                        items.append(parsed)
                    except:
                        pass
                return items
        else:
            logger.error("Could not find the end of the JSON array.")
            return []
            
    except Exception as e:
        logger.error(f"Error parsing JS file {JS_FILE_PATH}: {e}")
        return []

def sync_from_js():
    dicts = parse_js_pricelist()
    if not dicts:
        return False
        
    db = SessionLocal()
    try:
        updated_count = 0
        inserted_count = 0
        
        js_ids = [d.get("id") for d in dicts if "id" in d]
        
        for d in dicts:
            item_id = d.get("id")
            if not item_id:
                continue
                
            db_item = db.query(ProductModel).filter(ProductModel.id == item_id).first()
            if db_item:
                db_item.name = d.get("name", db_item.name)
                db_item.category = d.get("category", db_item.category)
                db_item.dn = d.get("dn", db_item.dn)
                db_item.componentType = d.get("componentType", db_item.componentType)
                db_item.height = d.get("height", db_item.height)
                db_item.zapasDol = d.get("zapasDol", db_item.zapasDol)
                db_item.zapasGora = d.get("zapasGora", db_item.zapasGora)
                db_item.zapasDolMin = d.get("zapasDolMin", db_item.zapasDolMin)
                db_item.zapasGoraMin = d.get("zapasGoraMin", db_item.zapasGoraMin)
                db_item.magazynWL = d.get("magazynWL", db_item.magazynWL)
                db_item.magazynKLB = d.get("magazynKLB", db_item.magazynKLB)
                db_item.formaStandardowaWL = d.get("formaStandardowaWL", db_item.formaStandardowaWL)
                db_item.formaStandardowaKLB = d.get("formaStandardowaKLB", db_item.formaStandardowaKLB)
                db_item.sync_status = "synced"
                updated_count += 1
            else:
                new_item = ProductModel(
                    id=item_id,
                    name=d.get("name", ""),
                    category=d.get("category"),
                    dn=d.get("dn"),
                    componentType=d.get("componentType"),
                    height=d.get("height"),
                    zapasDol=d.get("zapasDol"),
                    zapasGora=d.get("zapasGora"),
                    zapasDolMin=d.get("zapasDolMin"),
                    zapasGoraMin=d.get("zapasGoraMin"),
                    magazynWL=d.get("magazynWL", 1),
                    magazynKLB=d.get("magazynKLB", 1),
                    formaStandardowaWL=d.get("formaStandardowaWL", 1),
                    formaStandardowaKLB=d.get("formaStandardowaKLB", 1),
                    sync_status="synced"
                )
                db.add(new_item)
                inserted_count += 1
                
        db.commit()

        # Delete items from DB that are not in JS, for studnie only
        existing_all = db.query(ProductModel).all()
        studnie_types = ["dennica", "krag", "krag_ot", "konus", "plyta_din", "plyta_redukcyjna", "plyta_zamykajaca", "pierscien_odciazajacy", "przejscie", "wlaz"]
        for ex in existing_all:
            if ex.componentType in studnie_types and ex.id not in js_ids:
                db.delete(ex)
        db.commit()

        logger.info(f"Sync complete. Updated: {updated_count}, Inserted: {inserted_count}")
        return True
        
    except Exception as e:
        db.rollback()
        logger.error(f"Database sync error: {e}")
        return False
    finally:
        db.close()

async def watch_js_file():
    last_mtime = 0
    while True:
        try:
            if os.path.exists(JS_FILE_PATH):
                current_mtime = os.path.getmtime(JS_FILE_PATH)
                if current_mtime > last_mtime:
                    logger.info("Changes detected in pricelist_studnie.js. Synchronizing...")
                    success = sync_from_js()
                    if success:
                        last_mtime = current_mtime
        except Exception as e:
            logger.error(f"Watcher error: {e}")
        
        await asyncio.sleep(POLL_INTERVAL)

def start_watcher_task():
    loop = asyncio.get_event_loop()
    loop.create_task(watch_js_file())
