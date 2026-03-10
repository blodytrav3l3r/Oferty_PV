from html.parser import HTMLParser

class DetailPrinter(HTMLParser):
    def __init__(self):
        super().__init__()
        self.depth = 0
        self.out = []
        
    def handle_starttag(self, tag, attrs):
        if tag in ['div', 'main']:
            d = dict(attrs)
            c = d.get('class', '')
            if tag == 'main' or 'well-app-layout' in c or 'well-center-column' in c or 'wells-sidebar' in c or 'section-builder' in d.get('id', ''):
                self.out.append(f'Line {self.getpos()[0]}: <{tag} class="{c}" id="{d.get("id", "")}"> (Depth {self.depth})')
            self.depth += 1

    def handle_endtag(self, tag):
        if tag in ['div', 'main']:
            self.depth -= 1
            if tag == 'main':
                self.out.append(f'Line {self.getpos()[0]}: </main> (Depth {self.depth})')

p = DetailPrinter()
with open('public/studnie.html', 'r', encoding='utf-8') as f:
    p.feed(f.read())
print('\n'.join(p.out))
