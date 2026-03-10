from html.parser import HTMLParser

class StructurePrinter(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.in_builder = False
        self.out = []
        
    def handle_starttag(self, tag, attrs):
        if tag == 'div':
            d_attrs = dict(attrs)
            if d_attrs.get('id') == 'section-builder':
                self.in_builder = True
            if self.in_builder:
                class_str = d_attrs.get('class', '')
                id_str = d_attrs.get('id', '')
                self.out.append('  ' * self.depth + f'<div id="{id_str}" class="{class_str}">')
                self.depth += 1

    def handle_endtag(self, tag):
        if tag == 'div' and self.in_builder:
            self.depth -= 1
            self.out.append('  ' * self.depth + '</div>')
            if self.depth == 0:
                self.in_builder = False

parser = StructurePrinter()
with open('public/studnie.html', 'r', encoding='utf-8') as f:
    parser.feed(f.read())
with open('dom_structure.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(parser.out))
