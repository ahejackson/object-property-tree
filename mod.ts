/**
 * This module contains functions to build a tree representation of a JavaScript object
 * and format it for logging. Handles complex objects, arrays, primitives,
 * circular references, and property access errors gracefully.
 * @module
 *
 *
 * ## Guide
 *
 * The simplest way to use the package is with {@linkcode logPropertyTree}, which builds the tree and prints its formatted representation directly to the console:
 *
 * ```ts
 * logPropertyTree(obj: unknown, maxDepth: number = 3, rootName?: string)
 * ```
 *
 * You can also use the build and format the tree separately:
 *
 * **Build an object's property tree** with {@linkcode buildPropertyTree}
 * - Throws {@linkcode InvalidDepthError} if `maxDepth` is negative or not an integer.
 * ```ts
 * buildPropertyTree(obj: unknown, maxDepth, rootName?: string): PropertyTreeNode
 * ```
 *
 * **Format a tree into a readable string** (or any tree node and its children) with {@linkcode formatPropertyTreeToString}.
 * ```ts
 * formatPropertyTreeToString(rootNode: PropertyTreeNode): string
 * ```
 *
 * ## Example
 *
 * For a complex object with a circular reference:
 *
 * ```ts
 * const complexObject = {
 *   id: 123,
 *   user: {
 *     name: "Alice",
 *     roles: ["admin", "editor"],
 *     settings: {
 *       theme: "dark",
 *       notifications: true,
 *     },
 *   },
 *   data: [null, undefined, Symbol("unique")],
 *   method: () => "hello",
 * };
 *
 * // Create a circular reference
 * (complexObject as any).user.self = complexObject.user;
 * ```
 *
 * Log the object's property tree with a max depth of 3:
 *
 * ```ts
 * import { logPropertyTree } from "@adamj/object-property-tree"
 *
 * console.log("Logging property tree (max depth 3)");
 * logPropertyTree(complexObject, 3, "myObject");
 * ```
 *
 * ```text
 * Logging property tree (max depth 3):
 * └─ myObject (object)
 *    ├─ id (number): 123
 *    ├─ user (object)
 *    │  ├─ name (string): "Alice"
 *    │  ├─ roles (array)
 *    │  │  ├─ [0] (string): "admin"
 *    │  │  └─ [1] (string): "editor"
 *    │  ├─ settings (object)
 *    │  │  ├─ theme (string): "dark"
 *    │  │  └─ notifications (boolean): true
 *    │  └─ self (object): [Circular Reference]
 *    ├─ data (array)
 *    │  ├─ [0] (null): null
 *       │  ├─ [1] (undefined): undefined
 *       │  └─ [2] (symbol): Symbol(unique)
 *       └─ method (function)
 * ```
 *
 * Log the object root only:
 *
 * ```ts
 * import { logPropertyTree } from "@adamj/object-property-tree"
 *
 * console.log("Logging only root (max depth 0):");
 * logPropertyTree(complexObject, 0);
 * ```
 *
 * ```text
 * Logging only root (max depth 0):
 * └─ root (object)
 * ```
 *
 * It can handle primitive values too:
 *
 * ```ts
 * import { logPropertyTree } from "@adamj/object-property-tree"
 *
 * console.log("Logging primitive:");
 * logPropertyTree("Just a string", 1);
 * ```
 *
 * ```text
 * Logging primitive:
 * └─ root (string): "Just a string"
 * ```
 */

export * from "./src/object-property-tree.ts";
