from html.parser import HTMLParser

class StructurePrinter(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.out = []
        
    def handle_starttag(self, tag, attrs):
        if tag == 'div':
            d_attrs = dict(attrs)
            class_str = d_attrs.get('class', '')
            id_str = d_attrs.get('id', '')
            if 'wells-sidebar' in class_str or 'section-offer' in class_str:
                self.out.append(f'depth {self.depth}: <div id="{id_str}" class="{class_str}">')
            self.depth += 1

    def handle_endtag(self, tag):
        if tag == 'div':
            self.depth -= 1

parser = StructurePrinter()
with open('public/studnie.html', 'r', encoding='utf-8') as f:
    parser.feed(f.read())
with open('dom_sidebar.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(parser.out))
