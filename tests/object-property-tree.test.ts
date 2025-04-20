import { assertEquals, assertExists, assertThrows } from "jsr:@std/assert";
import { describe, it } from "jsr:@std/testing/bdd";
import {
	InvalidDepthError,
	buildPropertyTree,
	formatPropertyTreeToString,
} from "../mod.ts";

// --- Constants for Markers ---
const CIRCULAR_REFERENCE_MARKER = "[Circular Reference]";
const ACCESS_ERROR_MARKER = "[Access Error]";

describe("buildPropertyTree", () => {
	// Test basic primitive types
	it("should handle primitive types correctly at the root", () => {
		const stringResult = buildPropertyTree("test string", 1);
		assertEquals(stringResult.name, "root");
		assertEquals(stringResult.type, "string");
		assertEquals(stringResult.value, "test string");
		assertEquals(stringResult.children, undefined);

		const numberResult = buildPropertyTree(42, 1);
		assertEquals(numberResult.name, "root");
		assertEquals(numberResult.type, "number");
		assertEquals(numberResult.value, 42);

		const boolResult = buildPropertyTree(true, 1);
		assertEquals(boolResult.name, "root");
		assertEquals(boolResult.type, "boolean");
		assertEquals(boolResult.value, true);

		const symbolResult = buildPropertyTree(Symbol("test"), 1);
		assertEquals(symbolResult.name, "root");
		assertEquals(symbolResult.type, "symbol");
		// Note: We don't compare symbol values directly as they are unique
		assertEquals(typeof symbolResult.value, "symbol");

		const bigintResult = buildPropertyTree(123n, 1);
		assertEquals(bigintResult.name, "root");
		assertEquals(bigintResult.type, "bigint");
		assertEquals(bigintResult.value, 123n);
	});

	// Test null and undefined
	it("should handle null and undefined correctly at the root", () => {
		const nullResult = buildPropertyTree(null, 1);
		assertEquals(nullResult.name, "root");
		assertEquals(nullResult.type, "null");
		assertEquals(nullResult.value, null);

		const undefinedResult = buildPropertyTree(undefined, 1);
		assertEquals(undefinedResult.name, "root");
		assertEquals(undefinedResult.type, "undefined");
		assertEquals(undefinedResult.value, undefined);
	});

	// Test objects
	it("should process simple objects correctly", () => {
		const testObj = { name: "Test", value: 123 };
		const result = buildPropertyTree(testObj, 2); // Depth 2 to see children

		assertEquals(result.type, "object");
		assertEquals(result.name, "root");
		assertExists(result.children);
		assertEquals(result.children.length, 2);
		assertEquals(result.value, undefined); // Root object node shouldn't have value

		// Find the name property in children
		const nameNode = result.children.find((child) => child.name === "name");
		assertExists(nameNode);
		assertEquals(nameNode.type, "string");
		assertEquals(nameNode.value, "Test");

		// Find the value property in children
		const valueNode = result.children.find((child) => child.name === "value");
		assertExists(valueNode);
		assertEquals(valueNode.type, "number");
		assertEquals(valueNode.value, 123);
	});

	// Test arrays
	it("should process simple arrays correctly", () => {
		const testArray = [1, "two", true];
		const result = buildPropertyTree(testArray, 2); // Depth 2 to see children

		assertEquals(result.type, "array");
		assertEquals(result.name, "root");
		assertExists(result.children);
		assertEquals(result.children.length, 3);
		assertEquals(result.value, undefined); // Root array node shouldn't have value

		// Check array items
		const item0 = result.children.find((child) => child.name === "[0]");
		assertExists(item0);
		assertEquals(item0.type, "number");
		assertEquals(item0.value, 1);

		const item1 = result.children.find((child) => child.name === "[1]");
		assertExists(item1);
		assertEquals(item1.type, "string");
		assertEquals(item1.value, "two");

		const item2 = result.children.find((child) => child.name === "[2]");
		assertExists(item2);
		assertEquals(item2.type, "boolean");
		assertEquals(item2.value, true);
	});

	// Test nested objects and depth limiting
	it("should respect depth limits for nested objects", () => {
		const nestedObj = {
			level1: {
				level2: {
					level3: "deep value",
				},
			},
		};

		// Test with depth 0 (root only)
		const depth0Result = buildPropertyTree(nestedObj, 0);
		assertEquals(depth0Result.name, "root");
		assertEquals(depth0Result.type, "object");
		assertEquals(depth0Result.children, undefined);
		assertEquals(depth0Result.value, undefined);

		// Test with depth 1 (should stop at level1)
		const depth1Result = buildPropertyTree(nestedObj, 1);
		assertExists(depth1Result.children);
		assertEquals(depth1Result.children.length, 1);
		const level1Node_d1 = depth1Result.children[0];
		assertEquals(level1Node_d1.name, "level1");
		assertEquals(level1Node_d1.type, "object");
		assertEquals(level1Node_d1.children, undefined); // Not expanded
		assertEquals(level1Node_d1.value, undefined); // No value for unexpanded object

		// Test with depth 2 (should stop at level2)
		const depth2Result = buildPropertyTree(nestedObj, 2);
		assertExists(depth2Result.children);
		const level1Node_d2 = depth2Result.children[0];
		assertEquals(level1Node_d2.name, "level1");
		assertExists(level1Node_d2.children);
		assertEquals(level1Node_d2.children.length, 1);
		const level2Node_d2 = level1Node_d2.children[0];
		assertEquals(level2Node_d2.name, "level2");
		assertEquals(level2Node_d2.type, "object");
		assertEquals(level2Node_d2.children, undefined); // Not expanded
		assertEquals(level2Node_d2.value, undefined); // No value

		// Test with depth 3 (should reach level3)
		const depth3Result = buildPropertyTree(nestedObj, 3);
		assertExists(depth3Result.children);
		const level1Node_d3 = depth3Result.children[0];
		assertExists(level1Node_d3.children);
		const level2Node_d3 = level1Node_d3.children[0];
		assertExists(level2Node_d3.children);
		assertEquals(level2Node_d3.children.length, 1);
		const level3Node_d3 = level2Node_d3.children[0];
		assertEquals(level3Node_d3.name, "level3");
		assertEquals(level3Node_d3.type, "string");
		assertEquals(level3Node_d3.value, "deep value"); // Value present
	});

	// Test circular references
	it("should handle circular references", () => {
		const circularObj: Record<string, unknown> = { name: "Circular" };
		circularObj.self = circularObj; // Direct circular reference

		const result = buildPropertyTree(circularObj, 3); // Depth 3 to see the cycle
		assertEquals(result.type, "object");
		assertExists(result.children);

		const selfNode = result.children.find((child) => child.name === "self");
		assertExists(selfNode);
		assertEquals(selfNode.type, "object"); // Type remains object
		assertEquals(selfNode.value, CIRCULAR_REFERENCE_MARKER); // Value indicates cycle
		assertEquals(selfNode.children, undefined); // Not expanded further
	});

	// Test complex object with mixed types
	it("should handle complex objects with mixed types", () => {
		const complexObj = {
			name: "Complex",
			values: [1, { nested: true }, 3],
			nestedObj: { a: true, b: null },
			fn: () => "test",
		};

		const result = buildPropertyTree(complexObj, 3); // Depth 3 needed for nested array obj
		assertEquals(result.type, "object");
		assertExists(result.children);
		assertEquals(result.children.length, 4);

		// Check values array
		const valuesNode = result.children.find((c) => c.name === "values");
		assertExists(valuesNode);
		assertEquals(valuesNode.type, "array");
		assertExists(valuesNode.children);
		assertEquals(valuesNode.children.length, 3);
		const nestedInArray = valuesNode.children.find((c) => c.name === "[1]");
		assertExists(nestedInArray);
		assertEquals(nestedInArray.type, "object");
		assertExists(nestedInArray.children);
		assertEquals(nestedInArray.children.length, 1);
		assertEquals(nestedInArray.children[0].name, "nested");
		assertEquals(nestedInArray.children[0].type, "boolean");
		assertEquals(nestedInArray.children[0].value, true);

		// Check nested object
		const nestedObjNode = result.children.find((c) => c.name === "nestedObj");
		assertExists(nestedObjNode);
		assertEquals(nestedObjNode.type, "object");
		assertExists(nestedObjNode.children);
		assertEquals(nestedObjNode.children.length, 2);
		const bNode = nestedObjNode.children.find((c) => c.name === "b");
		assertExists(bNode);
		assertEquals(bNode.type, "null");
		assertEquals(bNode.value, null);

		// Check function
		const fnNode = result.children.find((c) => c.name === "fn");
		assertExists(fnNode);
		assertEquals(fnNode.type, "function");
		assertEquals(fnNode.value, undefined); // No value for functions
		assertEquals(fnNode.children, undefined); // Not expanded
	});

	// Test property access errors (using getters)
	it("should handle property access errors from getters", () => {
		const objWithGetterError = {
			safe: "ok",
			get problematic() {
				throw new Error("Getter failed!");
			},
			nested: {
				get alsoProblematic() {
					throw new Error("Nested getter failed!");
				},
			},
		};

		// Test with depth 2 to reach nested problematic getter
		const result = buildPropertyTree(objWithGetterError, 2);
		assertEquals(result.type, "object");
		assertExists(result.children);
		assertEquals(result.children.length, 3); // safe, problematic, nested

		// Check safe property
		const safeNode = result.children.find((c) => c.name === "safe");
		assertExists(safeNode);
		assertEquals(safeNode.type, "string");
		assertEquals(safeNode.value, "ok");

		// Check problematic property (top level)
		const problematicNode = result.children.find(
			(c) => c.name === "problematic",
		);
		assertExists(problematicNode);
		assertEquals(problematicNode.type, "error");
		assertEquals(problematicNode.value, ACCESS_ERROR_MARKER);
		assertEquals(problematicNode.children, undefined);

		// Check nested property (which itself contains an error)
		const nestedNode = result.children.find((c) => c.name === "nested");
		assertExists(nestedNode);
		assertEquals(nestedNode.type, "object"); // Parent is still object
		assertExists(nestedNode.children);
		assertEquals(nestedNode.children.length, 1); // Contains the error node

		const alsoProblematicNode = nestedNode.children[0];
		assertEquals(alsoProblematicNode.name, "alsoProblematic");
		assertEquals(alsoProblematicNode.type, "error");
		assertEquals(alsoProblematicNode.value, ACCESS_ERROR_MARKER);
	});

	// Test invalid depth parameter
	it("should throw InvalidDepthError for invalid depth parameters", () => {
		// Negative depth
		assertThrows(
			() => {
				buildPropertyTree({ test: "value" }, -1);
			},
			InvalidDepthError,
			"Invalid maxDepth: -1. Must be a non-negative integer.",
		);

		// Non-integer depth
		assertThrows(
			() => {
				buildPropertyTree({ test: "value" }, 1.5);
			},
			InvalidDepthError,
			"Invalid maxDepth: 1.5. Must be a non-negative integer.",
		);

		// Should not throw for valid depth 0
		buildPropertyTree({ test: "value" }, 0);
	});

	// Test with empty objects and arrays
	it("should handle empty objects and arrays", () => {
		const emptyObjResult = buildPropertyTree({}, 1); // Depth 1 to check children array
		assertEquals(emptyObjResult.type, "object");
		assertExists(emptyObjResult.children); // Children array should exist
		assertEquals(emptyObjResult.children.length, 0); // But be empty

		const emptyArrResult = buildPropertyTree([], 1); // Depth 1 to check children array
		assertEquals(emptyArrResult.type, "array");
		assertExists(emptyArrResult.children); // Children array should exist
		assertEquals(emptyArrResult.children.length, 0); // But be empty
	});
});

describe("formatPropertyTreeToString", () => {
	it("should format a primitive root node", () => {
		const tree = buildPropertyTree("hello", 1);
		const expected = `└─ root (string): "hello"`;
		assertEquals(formatPropertyTreeToString(tree), expected);
	});

	it("should format a null root node", () => {
		const tree = buildPropertyTree(null, 1);
		const expected = "└─ root (null): null";
		assertEquals(formatPropertyTreeToString(tree), expected);
	});

	it("should format a simple object", () => {
		const tree = buildPropertyTree({ a: 1, b: "bee" }, 2);
		const expected = `
└─ root (object)
   ├─ a (number): 1
   └─ b (string): "bee"
`.trim(); // Use trim() to remove leading/trailing whitespace from template literal
		assertEquals(formatPropertyTreeToString(tree), expected);
	});

	it("should format a simple array", () => {
		const tree = buildPropertyTree([true, 42], 2);
		const expected = `
└─ root (array)
   ├─ [0] (boolean): true
   └─ [1] (number): 42
`.trim();
		assertEquals(formatPropertyTreeToString(tree), expected);
	});

	it("should format a nested structure", () => {
		const tree = buildPropertyTree({ data: [null, { val: "x" }] }, 3);
		const expected = `
└─ root (object)
   └─ data (array)
      ├─ [0] (null): null
      └─ [1] (object)
         └─ val (string): "x"
`.trim();
		assertEquals(formatPropertyTreeToString(tree), expected);
	});

	it("should format a tree reaching max depth", () => {
		const tree = buildPropertyTree({ level1: { level2: "hi" } }, 1); // Max depth 1
		const expected = `
└─ root (object)
   └─ level1 (object)
`.trim(); // level1 is not expanded, no value shown
		assertEquals(formatPropertyTreeToString(tree), expected);
	});

	it("should format a tree with depth 0", () => {
		const tree = buildPropertyTree({ level1: { level2: "hi" } }, 0); // Max depth 0
		const expected = "└─ root (object)"; // Root only, no children, no value
		assertEquals(formatPropertyTreeToString(tree), expected);
	});

	it("should format a tree with a circular reference", () => {
		const circularObj: Record<string, unknown> = { name: "Circular" };
		circularObj.self = circularObj;
		const tree = buildPropertyTree(circularObj, 3);
		const expected = `
└─ root (object)
   ├─ name (string): "Circular"
   └─ self (object): [Circular Reference]
`.trim();
		assertEquals(formatPropertyTreeToString(tree), expected);
	});

	it("should format a tree with an access error", () => {
		const objWithGetterError = {
			safe: "ok",
			get problematic() {
				throw new Error("Getter failed!");
			},
		};
		const tree = buildPropertyTree(objWithGetterError, 2);
		const expected = `
└─ root (object)
   ├─ safe (string): "ok"
   └─ problematic (error): [Access Error]
`.trim();
		assertEquals(formatPropertyTreeToString(tree), expected);
	});

	it("should format a tree with a function", () => {
		const tree = buildPropertyTree({ myFunc: () => {} }, 2);
		const expected = `
└─ root (object)
   └─ myFunc (function)
`.trim(); // Functions show type but no value or children
		assertEquals(formatPropertyTreeToString(tree), expected);
	});

	it("should format an empty object", () => {
		const tree = buildPropertyTree({}, 1);
		const expected = "└─ root (object)"; // No children shown
		assertEquals(formatPropertyTreeToString(tree), expected);
	});

	it("should format an empty array", () => {
		const tree = buildPropertyTree([], 1);
		const expected = "└─ root (array)"; // No children shown
		assertEquals(formatPropertyTreeToString(tree), expected);
	});

	it("should handle multi-line strings and truncation", () => {
		const longString =
			"This is a very long string that definitely exceeds the fifty character limit set for display purposes.";
		const multiLine = "First line\nSecond line";
		const tree = buildPropertyTree({ long: longString, multi: multiLine }, 2);
		const expected = `
└─ root (object)
   ├─ long (string): "This is a very long string that definitely exceeds..."
   └─ multi (string): "First line\\nSecond line"
`.trim();
		assertEquals(formatPropertyTreeToString(tree), expected);
	});
});
