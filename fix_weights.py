import json
import re
import math

def calculate_weight(dn):
    # D in meters = dn / 1000
    # Radius in meters = dn / 2000
    # Volume = pi * R^2 * H
    # H = 0.15 m
    # Density approx = 2400 kg/m^3 (concrete)
    vol = math.pi * ((dn / 2000) ** 2) * 0.15
    weight = round(vol * 2400)
    # Return as negative so it subtracts from total weight of the well
    return -weight

def process_file(filepath):
    print(f"Processing {filepath}...")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    def replacer(match):
        obj_text = match.group(0)
        
        dn_match = re.search(r'"dn"\s*:\s*(\d+)', obj_text)
        if not dn_match: 
            return obj_text
            
        dn = int(dn_match.group(1))
        weight = calculate_weight(dn)
        
        # Replace or add weight. Right now weight could be null.
        if '"weight": null' in obj_text:
            obj_text = re.sub(r'"weight"\s*:\s*null', f'"weight": {weight}', obj_text)
        elif re.search(r'"weight"\s*:', obj_text):
            obj_text = re.sub(r'"weight"\s*:\s*[^,}\s]+', f'"weight": {weight}', obj_text)
        else:
            obj_text = re.sub(r'"componentType"', f'"weight": {weight},\n        "componentType"', obj_text)
            
        return obj_text
        
    pattern = re.compile(r'\{[^{}]*"componentType"\s*:\s*"przejscie"[^{}]*\}', re.DOTALL)
    new_content = pattern.sub(replacer, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}.")
    else:
        print(f"No changes to {filepath}.")

process_file('g:\\GitHub\\Oferty_PV\\pricelist_studnie.js')
process_file('g:\\GitHub\\Oferty_PV\\pricelist_przejscia.js')
process_file('g:\\GitHub\\Oferty_PV\\data\\products_studnie.json')
