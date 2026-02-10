export interface Snippet {
  trigger: string;
  label: string;
  code: string;
  cursorOffset?: number; // characters from end where cursor should go
}

export const PYTHON_SNIPPETS: Snippet[] = [
  {
    trigger: "for",
    label: "for i in range():",
    code: "for i in range():\n    ",
    cursorOffset: 6,
  },
  {
    trigger: "forr",
    label: "for item in list:",
    code: "for item in :\n    ",
    cursorOffset: 6,
  },
  {
    trigger: "if",
    label: "if condition:",
    code: "if :\n    ",
    cursorOffset: 6,
  },
  {
    trigger: "ife",
    label: "if/else",
    code: "if :\n    \nelse:\n    ",
    cursorOffset: 20,
  },
  {
    trigger: "def",
    label: "def function():",
    code: "def ():\n    ",
    cursorOffset: 7,
  },
  {
    trigger: "class",
    label: "class Name:",
    code: "class :\n    def __init__(self):\n        ",
    cursorOffset: 35,
  },
  {
    trigger: "try",
    label: "try/except",
    code: "try:\n    \nexcept Exception as e:\n    print(e)",
    cursorOffset: 33,
  },
  {
    trigger: "with",
    label: "with open() as f:",
    code: 'with open("", "r") as f:\n    ',
    cursorOffset: 20,
  },
  {
    trigger: "main",
    label: 'if __name__ == "__main__":',
    code: 'if __name__ == "__main__":\n    ',
    cursorOffset: 0,
  },
  {
    trigger: "init",
    label: "def __init__(self):",
    code: "def __init__(self):\n    ",
    cursorOffset: 0,
  },
  {
    trigger: "while",
    label: "while condition:",
    code: "while :\n    ",
    cursorOffset: 6,
  },
  {
    trigger: "lambda",
    label: "lambda x: expression",
    code: "lambda x: ",
    cursorOffset: 0,
  },
  {
    trigger: "print",
    label: "print()",
    code: "print()",
    cursorOffset: 1,
  },
  {
    trigger: "imp",
    label: "import module",
    code: "import ",
    cursorOffset: 0,
  },
  {
    trigger: "from",
    label: "from module import",
    code: "from  import ",
    cursorOffset: 8,
  },
  {
    trigger: "list",
    label: "list comprehension",
    code: "[ for x in ]",
    cursorOffset: 11,
  },
  {
    trigger: "dict",
    label: "dict comprehension",
    code: "{: for k, v in }",
    cursorOffset: 14,
  },
];
