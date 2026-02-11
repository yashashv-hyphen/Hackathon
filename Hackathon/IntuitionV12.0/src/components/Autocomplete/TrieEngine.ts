import { Trie } from "@/lib/trie";
import { ALL_PYTHON_ENTRIES } from "@/lib/dictionaries/python";
import { PYTHON_SNIPPETS, type Snippet } from "@/lib/dictionaries/snippets";

export interface Suggestion {
  text: string;
  type: "keyword" | "snippet";
  snippet?: Snippet;
}

class TrieEngine {
  private trie: Trie;
  private snippets: Snippet[];

  constructor() {
    this.trie = new Trie();
    this.snippets = PYTHON_SNIPPETS;

    // Load Python dictionary
    for (const [word, freq] of ALL_PYTHON_ENTRIES) {
      this.trie.insert(word, freq);
    }
  }

  getSuggestions(prefix: string, limit: number = 5): Suggestion[] {
    if (!prefix || prefix.length < 1) return [];

    const trimmed = prefix.trim();
    if (!trimmed) return [];

    // Get word matches from trie
    const wordMatches = this.trie.searchByPrefix(trimmed, limit);

    // Get snippet matches
    const snippetMatches = this.snippets.filter((s) =>
      s.trigger.startsWith(trimmed)
    );

    // Combine results: snippets first, then word matches
    const results: Suggestion[] = [];

    for (const snippet of snippetMatches.slice(0, 2)) {
      results.push({
        text: snippet.label,
        type: "snippet",
        snippet,
      });
    }

    for (const word of wordMatches) {
      if (results.length >= limit) break;
      // Avoid duplicates with snippet triggers
      if (!results.some((r) => r.text === word)) {
        results.push({ text: word, type: "keyword" });
      }
    }

    return results.slice(0, limit);
  }

  recordUsage(word: string): void {
    this.trie.incrementFrequency(word);
  }

  addWord(word: string): void {
    if (!this.trie.has(word)) {
      this.trie.insert(word, 1);
    }
  }
}

// Singleton instance
let instance: TrieEngine | null = null;

export function getTrieEngine(): TrieEngine {
  if (!instance) {
    instance = new TrieEngine();
  }
  return instance;
}
