interface TrieNode {
  children: Map<string, TrieNode>;
  isEnd: boolean;
  frequency: number;
  word: string | null;
}

function createNode(): TrieNode {
  return {
    children: new Map(),
    isEnd: false,
    frequency: 0,
    word: null,
  };
}

export class Trie {
  private root: TrieNode;

  constructor() {
    this.root = createNode();
  }

  insert(word: string, frequency: number = 1): void {
    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) {
        node.children.set(char, createNode());
      }
      node = node.children.get(char)!;
    }
    node.isEnd = true;
    node.frequency += frequency;
    node.word = word;
  }

  searchByPrefix(prefix: string, limit: number = 5): string[] {
    let node = this.root;
    for (const char of prefix) {
      if (!node.children.has(char)) {
        return [];
      }
      node = node.children.get(char)!;
    }

    // Collect all words under this prefix using a max-heap approach
    const results: { word: string; frequency: number }[] = [];
    this._collect(node, results);

    // Sort by frequency descending, then alphabetically
    results.sort((a, b) => b.frequency - a.frequency || a.word.localeCompare(b.word));

    return results.slice(0, limit).map((r) => r.word);
  }

  private _collect(
    node: TrieNode,
    results: { word: string; frequency: number }[]
  ): void {
    if (node.isEnd && node.word) {
      results.push({ word: node.word, frequency: node.frequency });
    }
    const values = Array.from(node.children.values());
    for (let i = 0; i < values.length; i++) {
      this._collect(values[i], results);
    }
  }

  incrementFrequency(word: string): void {
    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) return;
      node = node.children.get(char)!;
    }
    if (node.isEnd) {
      node.frequency++;
    }
  }

  has(word: string): boolean {
    let node = this.root;
    for (const char of word) {
      if (!node.children.has(char)) return false;
      node = node.children.get(char)!;
    }
    return node.isEnd;
  }
}
