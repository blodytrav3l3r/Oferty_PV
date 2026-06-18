import sys, json, re
from pathlib import Path
from networkx.readwrite import json_graph
import networkx as nx
from collections import deque

GRAPHIFY_OUT = Path('graphify-out')

def load_graph():
    data = json.loads((GRAPHIFY_OUT / 'graph.json').read_text(encoding='utf-8'))
    return json_graph.node_link_graph(data, edges='links')

def search_nodes(G, query, limit=20):
    q = query.lower()
    results = []
    for n, d in G.nodes(data=True):
        label = d.get('label', n)
        src = d.get('source_file', '')
        if q in n.lower() or q in label.lower() or q in src.lower():
            results.append((n, label, src))
    results.sort(key=lambda x: G.degree(x[0]), reverse=True)
    return results[:limit]

def bfs_subgraph(G, seeds, max_nodes=50, max_depth=2):
    nodes = set(seeds)
    frontier = deque((s, 0) for s in seeds)
    while frontier:
        node, depth = frontier.popleft()
        if depth >= max_depth or len(nodes) >= max_nodes:
            continue
        for neighbor in G.neighbors(node):
            if neighbor not in nodes:
                nodes.add(neighbor)
                if len(nodes) < max_nodes:
                    frontier.append((neighbor, depth + 1))
    return G.subgraph(nodes)

def format_subgraph(H, seeds):
    lines = []
    for n, d in H.nodes(data=True):
        label = d.get('label', n)
        src = d.get('source_file', '')
        deg = H.degree(n)
        marker = ' [SEED]' if n in seeds else ''
        lines.append(f"  {label}{marker}  (deg={deg})  {src}")
    if H.edges():
        lines.append("")
        lines.append("Edges:")
        for u, v, ed in H.edges(data=True):
            rel = ed.get('relation', 'connected_to')
            u_label = H.nodes[u].get('label', u)
            v_label = H.nodes[v].get('label', v)
            lines.append(f"  {u_label} --{rel}--> {v_label}")
    return "\n".join(lines)

def main():
    query = ' '.join(sys.argv[1:]) if len(sys.argv) > 1 else ''
    if not query:
        print("Usage: graphify query <question>")
        print("       graphify query <question> --dfs")
        print("       graphify path <node1> <node2>")
        sys.exit(1)

    mode = 'bfs'
    if '--dfs' in sys.argv:
        mode = 'dfs'
        sys.argv.remove('--dfs')
        query = ' '.join(sys.argv[1:])
    if query.startswith('path ') or (len(sys.argv) >= 4 and sys.argv[1] == 'path'):
        mode = 'path'

    G = load_graph()

    if mode == 'path':
        terms = sys.argv[2:] if sys.argv[1] == 'path' else query[5:].split()
        if len(terms) < 2:
            print("path needs two node names")
            sys.exit(1)
        hits1 = search_nodes(G, terms[0], 5)
        hits2 = search_nodes(G, terms[1], 5)
        if not hits1 or not hits2:
            print(f"No nodes found for '{terms[0]}' or '{terms[1]}'")
            sys.exit(1)
        n1, n2 = hits1[0][0], hits2[0][0]
        try:
            path = nx.shortest_path(G, n1, n2)
            print(f"Shortest path ({len(path)-1} hops):")
            for p in path:
                d = G.nodes[p]
                print(f"  {d.get('label', p)}  ({d.get('source_file', '')})")
        except nx.NetworkXNoPath:
            print("No path between these nodes")
        return

    seeds = search_nodes(G, query, 10)
    if not seeds:
        print(f"No results for '{query}'")
        sys.exit(1)

    seed_ids = [s[0] for s in seeds]
    print(f"Found {len(seed_ids)} matching nodes (top by degree):")
    for n, label, src in seeds:
        print(f"  {label}  ({src})")
    print()

    if mode == 'dfs':
        H = bfs_subgraph(G, seed_ids, max_nodes=30, max_depth=5)
    else:
        H = bfs_subgraph(G, seed_ids, max_nodes=50, max_depth=2)
    print(format_subgraph(H, set(seed_ids)))
    print(f"\nSubgraph: {H.number_of_nodes()} nodes, {H.number_of_edges()} edges")

if __name__ == '__main__':
    main()
