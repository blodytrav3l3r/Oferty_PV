import json

with open(r'g:\GitHub\Oferty_PV\extracted_studnie_data.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Format the JS file
js_content = "window.STUDNIE_DATA = " + json.dumps(data, indent=2, ensure_ascii=False) + ";\n"

with open(r'g:\GitHub\Oferty_PV\studnie_pricelist.js', 'w', encoding='utf-8') as f:
    f.write(js_content)

print("Generated studnie_pricelist.js")
