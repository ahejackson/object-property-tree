# object-property-tree

[![JSR](https://jsr.io/badges/@adamj/object-property-tree)](https://jsr.io/@adamj/object-property-tree)

Simple TypeScript utility to build and display a the property tree of JavaScript objects. Handles nesting, circular references, and access errors.


## Description

This package provides utilities to generate a structured tree representation of any JavaScript object or value. It intelligently handles nested objects and arrays up to a specified depth, detects and marks circular references, gracefully manages property access errors (e.g., from getters), and includes a function to format the resulting tree into a human-readable string for debugging or inspection.

Useful for logging complex object structures during development and debugging.


## Installation

Add the package to your project from [JSR](https://jsr.io/@adamj/object-property-tree).

Deno:
```sh
deno add jsr:@adamj/object-property-tree
```

pnpm 10.9+
```sh
pnpm add jsr:@adamj/object-property-tree
```

yarn 4.9+
```sh
yarn add jsr:@adamj/object-property-tree
```

npm
```sh
npx jsr add @adamj/object-property-tree
```

bun
```sh
bunx jsr add @adamj/object-property-tree
```


## Guide

The simplest way to use the package is with `logPropertyTree`, which builds the tree and prints its formatted representation directly to the console:

```typescript
logPropertyTree(obj: unknown, maxDepth: number = 3, rootName?: string)
```

**Build an object's property tree**
- Throws `InvalidDepthError` if `maxDepth` is negative or not an integer.
```typescript
buildPropertyTree(obj: unknown, maxDepth, rootName?: string): PropertyTreeNode
```

**Format a tree into a readable string** (or any tree node and its children).
```typescript
formatPropertyTreeToString(rootNode: PropertyTreeNode): string
```

## Example

For a complex object with a circular reference:

```typescript
const complexObject = {
  id: 123,
  user: {
    name: "Alice",
    roles: ["admin", "editor"],
    settings: {
      theme: "dark",
      notifications: true,
    },
  },
  data: [null, undefined, Symbol("unique")],
  method: () => "hello",
};

// Create a circular reference
(complexObject as any).user.self = complexObject.user;
```

Log the object's property tree with a max depth of 3:

```typescript
import { logPropertyTree } from "@adamj/object-property-tree"

console.log("Logging property tree (max depth 3)");
logPropertyTree(complexObject, 3, "myObject"); 
```

```text
Logging property tree (max depth 3):
└─ myObject (object)
   ├─ id (number): 123
   ├─ user (object)
   │  ├─ name (string): "Alice"
   │  ├─ roles (array)
   │  │  ├─ [0] (string): "admin"
   │  │  └─ [1] (string): "editor"
   │  ├─ settings (object)
   │  │  ├─ theme (string): "dark"
   │  │  └─ notifications (boolean): true
   │  └─ self (object): [Circular Reference]
   ├─ data (array)
   │  ├─ [0] (null): null
   │  ├─ [1] (undefined): undefined
   │  └─ [2] (symbol): Symbol(unique)
   └─ method (function)
```

Log the object root only:

```typescript
import { logPropertyTree } from "@adamj/object-property-tree"

console.log("Logging only root (max depth 0):");
logPropertyTree(complexObject, 0); 
```

```text
Logging only root (max depth 0):
└─ root (object)
```

It can handle primitive values too:

```typescript
import { logPropertyTree } from "@adamj/object-property-tree"

console.log("Logging primitive:");
logPropertyTree("Just a string", 1); 
```

```text
Logging primitive:
└─ root (string): "Just a string"
```
