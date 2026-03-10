import os

file_path = 'public/studnie.html'

with open(file_path, 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Grab left block
start_left = html.find('<!-- LEFT: Well Diagram -->')
end_left = html.find('<!-- CENTER: Config area -->')
left_block = html[start_left:end_left].strip()

# 2. Grab right block
start_right = html.find('<!-- RIGHT: Wells list sidebar -->')
# Find the exact string marking the end of the sidebar
end_str = '</div>\n\n                </div>\n            </div> <!-- /wizard-step-3 -->'
idx_end_str = html.find(end_str)
right_block = html[start_right:idx_end_str].strip()

# 3. Remove them from their old locations
# The old layout starts at line 1691 with <div class="well-app-layout">
start_layout = html.find('<div class="well-app-layout">')
html = html[:start_layout] + html[end_left:]

# Now find the right block and remove it
new_start_right = html.find('<!-- RIGHT: Wells list sidebar -->')
new_idx_end_str = html.find(end_str)
# Remove from start of right block to end_str (exclusive, so we keep end_str)
html = html[:new_start_right] + html[new_idx_end_str:]

# 4. Insert at the top of section-builder
target_top = '<div class="section active" id="section-builder">\n'
top_idx = html.find(target_top) + len(target_top)
top_insert = f'''
        <div class="well-app-layout">
            {left_block}

            <!-- CENTER COLUMN -->
            <div class="well-center-column">
'''
html = html[:top_idx] + top_insert + html[top_idx:]

# 5. Insert at the bottom of section-builder
target_bottom = '        </div> <!-- /section-builder -->'
bottom_idx = html.find(target_bottom)
bottom_insert = f'''
            </div> <!-- /well-center-column -->

            {right_block}

        </div> <!-- /well-app-layout -->
'''
# We need to insert before the ending of section-builder, but wait, there is also </div> <!-- /wizard-step-3 --> which we kept.
# Let's see the exact end string:
# </div> <!-- /wizard-step-3 -->
# </div> <!-- /section-builder -->
target_bottom_search = '</div> <!-- /wizard-step-3 -->\n        </div> <!-- /section-builder -->'
b_idx = html.find(target_bottom_search)
if b_idx != -1:
    # Insert right after `</div> <!-- /wizard-step-3 -->\n`
    b_idx += len('</div> <!-- /wizard-step-3 -->\n')
    html = html[:b_idx] + bottom_insert + html[b_idx:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(html)

print("DOM correctly restructured.")
