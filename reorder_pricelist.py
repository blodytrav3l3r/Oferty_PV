import json
import re

file_path = r'g:\GitHub\Oferty_PV\studnie_pricelist.js'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

match = re.search(r'window\.STUDNIE_DATA\s*=\s*(\{.*\});', text, re.DOTALL)
if not match:
    print("Could not find STUDNIE_DATA")
    exit(1)

json_str = match.group(1)
data = json.loads(json_str)

def get_order_key(item, dn_str):
    name = item.get('name', '').lower()
    
    if 'waga' in name:
        return 90
    
    if 'uszczelka' in name:
        if dn_str.lower() in name: return 61
        if '1000' in name: return 62
        return 65
        
    if 'avr' in name:
        return 50
        
    if 'red.' in name or 'redukcyjna' in name:
        return 20

    if 'krąg' in name or 'wierc' in name:
        if dn_str.lower() in name:
            return 10
        if '1000' in name:
            return 30
            
    if 'konus' in name or 'najazdowa' in name or 'płyta din' in name or 'pze' in name or 'po ' in name or 'płyta 2000' in name:
        return 40

    if dn_str.lower() in name:
        return 15

    if '1000' in name:
        return 35

    return 25

def sort_nadbudowa(nadbudowa, dn_str):
    def sort_key(x):
        return (get_order_key(x, dn_str), x.get('col', 999))
    return sorted(nadbudowa, key=sort_key)

for dn in ['DN1200', 'DN1500', 'DN2000']:
    if dn in data:
        data[dn]['nadbudowa'] = sort_nadbudowa(data[dn]['nadbudowa'], dn.replace('DN', ''))

new_json_str = json.dumps(data, ensure_ascii=False, indent=2)

# Find where the json payload starts and ends
start = match.start(1)
end = match.end(1)
new_text = text[:start] + new_json_str + text[end:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_text)

print("Updated studnie_pricelist.js successfully")
