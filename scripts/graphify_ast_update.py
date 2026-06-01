"""
graphify_ast_update.py — AST-only incremental update for Graphify knowledge graph.
Called automatically by post-commit hook. Zero API cost, no LLM needed.
"""
import sys, json
from pathlib import Path
from networkx.readwrite import json_graph
import networkx as nx

GRAPHIFY_OUT = Path('graphify-out')

def main():
    from graphify.detect import detect_incremental, save_manifest
    from graphify.extract import collect_files, extract
    from graphify.build import build_from_json
    from graphify.export import to_json

    result = detect_incremental(Path('.'))
    deleted = list(result.get('deleted_files', []))
    new_files = result.get('new_files', {})
    all_changed = [f for files in new_files.values() for f in files]

    if not all_changed and not deleted:
        return

    # Force AST-only — only process code files
    code_exts = {'.py','.ts','.js','.go','.rs','.java','.cpp','.c','.rb','.swift','.kt',
                 '.cs','.scala','.php','.cc','.cxx','.hpp','.h','.kts','.lua','.toc',
                 '.css','.html','.yaml','.yml','.json'}
    code_files = [f for f in all_changed if Path(f).suffix.lower() in code_exts]

    if code_files:
        paths = [Path(f) for f in code_files]
        flat = []
        for p in paths:
            if p.is_dir():
                flat.extend(collect_files(p))
            else:
                flat.append(p)
        ast_result = extract(flat)
    else:
        ast_result = {'nodes': [], 'edges': [], 'hyperedges': [], 'input_tokens': 0, 'output_tokens': 0}

    # Merge into existing graph
    graph_file = GRAPHIFY_OUT / 'graph.json'
    if graph_file.exists():
        existing_data = json.loads(graph_file.read_text(encoding='utf-8'))
        G = json_graph.node_link_graph(existing_data, edges='links')
    else:
        G = nx.Graph()

    if deleted:
        to_remove = [n for n, d in G.nodes(data=True) if d.get('source_file') in set(deleted)]
        G.remove_nodes_from(to_remove)

    G_new = build_from_json(ast_result)
    G.update(G_new)

    to_json(G, {}, str(graph_file))
    save_manifest(result['files'])


if __name__ == '__main__':
    main()
