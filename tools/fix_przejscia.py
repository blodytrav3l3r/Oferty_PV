import json
import re

def process_file(filepath):
    print(f"Processing {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Przejscia are defined as JS objects.
    # Actually, pricelist_studnie.js defines `const DEFAULT_PRODUCTS_STUDNIE = [...]`
    # Let's write a regex that safely matches the PRZ- items.
    # It looks like:
    # {
    #     "id": "PRZ-1",
    #     "name": "GRP DN150",
    # ...
    # }
    
    def replacer(match):
        obj_text = match.group(0)
        
        # Extact name
        name_match = re.search(r'"name"\s*:\s*"([^"]+)"', obj_text)
        if not name_match: 
            return obj_text
            
        full_name = name_match.group(1)
        # full_name could be "GRP DN150" or "GRP Pecor Quattro DN200" or "K2KAN ID DN110"
        # Extract type and DN
        # Using a regex that optionally has "ID" or "XXL" before DN
        m = re.match(r'^(.+?)\s+DN(\d+)$', full_name)
        if not m:
            return obj_text
            
        ptype = m.group(1).strip()
        dn = m.group(2).strip()
        
        # Create id
        # replace spaces and non-alpha strings with dashes maybe, or just keep as is? 
        # The user said "indeks ma wyglądać DRP-150" for GRP DN150. "GRP" -> "GRP-150"
        # for "K2KAN ID" -> "K2KAN_ID-150" or "K2KAN-ID-150"
        safe_ptype = ptype.replace(" ", "-")
        new_id = f"{safe_ptype}-{dn}"
        
        # We need to change "id", "name", and "category"
        # "name": "GRP DN150" -> "name": "GRP"
        # "category": "Przejścia" -> "category": "GRP" (or whatever the type is)
        
        obj_text = re.sub(r'"id"\s*:\s*"PRZ-\d+"', f'"id": "{new_id}"', obj_text)
        obj_text = re.sub(r'"name"\s*:\s*"[^"]+"', f'"name": "{ptype}"', obj_text)
        
        # update category if it's "Przejścia"
        obj_text = re.sub(r'"category"\s*:\s*"Przejścia"', f'"category": "{ptype}"', obj_text)
        
        return obj_text
        
    # We find all things that look like przejscia json objects
    # They have "componentType": "przejscie" inside
    pattern = re.compile(r'\{[^{}]*"id"\s*:\s*"PRZ-\d+"[^{}]*"componentType"\s*:\s*"przejscie"[^{}]*\}', re.DOTALL)
    
    new_content = pattern.sub(replacer, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}.")
    else:
        print(f"No changes made to {filepath}.")

process_file('g:\\GitHub\\Oferty_PV\\pricelist_studnie.js')
process_file('g:\\GitHub\\Oferty_PV\\pricelist_przejscia.js')
process_file('g:\\GitHub\\Oferty_PV\\data\\products_studnie.json')
