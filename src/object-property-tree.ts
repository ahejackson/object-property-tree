// --- Constants ---

/** Marker string indicating a circular reference was detected. */
const CIRCULAR_REFERENCE_MARKER = "[Circular Reference]";
/** Marker string indicating an error occurred while accessing a property. */
const ACCESS_ERROR_MARKER = "[Access Error]";

// --- Custom Error Types ---

/**
 * Custom error class thrown when an invalid `maxDepth` parameter (non-integer or negative)
 * is passed to `buildPropertyTree`.
 */
export class InvalidDepthError extends Error {
	/** The invalid depth value that caused the error. */
	public readonly depth: number;

	constructor(depth: number) {
		super(`Invalid maxDepth: ${depth}. Must be a non-negative integer.`);
		this.name = "InvalidDepthError";
		this.depth = depth;

		// Maintains proper prototype chain for 'instanceof' checks.
		Object.setPrototypeOf(this, InvalidDepthError.prototype);
	}
}

// --- Core Types & Interfaces ---

/**
 * Represents the different types of values encountered during object traversal.
 */
type PropertyType =
	| "object"
	| "array"
	| "string"
	| "number"
	| "boolean"
	| "function"
	| "symbol"
	| "bigint"
	| "undefined"
	| "null"
	| "error"; // Special type for access errors

/**
 * Represents a node within the property tree. Each node corresponds to a property
 * or an array element in the original object structure.
 */
interface PropertyTreeNode {
	/**
	 * The name of the property or array index (as a string, e.g., "[0]").
	 * For the root node, this is typically "root".
	 */
	name: string;

	/** The type of the property's value, determined by `getPropertyType`. */
	type: PropertyType;

	/**
	 * The actual value of the property if it's a primitive, null, undefined,
	 * or a special marker (like circular reference/access error).
	 * Should only be present on nodes where the type is not 'object', 'array',
	 * or 'function', unless it's a special marker.
	 */
	value?: unknown;

	/**
	 * Child nodes representing properties of an object or elements of an array.
	 * Only present for 'object' or 'array' types that are expanded.
	 */
	children?: PropertyTreeNode[];
}

/**
 * Internal interface representing an item in the work queue used during the
 * iterative tree building process.
 */
interface WorkItem {
	/** The object or array to process. */
	obj: object | unknown[]; // Known to be object or array when queued

	/** The property name associated with this object/array (used for context, not node creation). */
	name: string;

	/** The current depth level in the object graph. */
	depth: number;

	/** The parent `PropertyTreeNode` to which children of `obj` should be added. */
	parent: PropertyTreeNode;

	/**
	 * A set containing references to objects already visited along the current path
	 * from the root to this `WorkItem`. Used for circular reference detection.
	 * A new copy is created for each branch.
	 */
	visited: Set<object>;
}

// --- Internal Helper Functions ---

/**
 * Determines the `PropertyType` of a given JavaScript value.
 * Handles primitives, null, arrays, objects, and functions.
 * @param value - The value to inspect.
 * @returns The corresponding `PropertyType`.
 */
function getPropertyType(value: unknown): PropertyType {
	if (value === null) {
		return "null";
	}
	if (Array.isArray(value)) {
		return "array";
	}
	const type = typeof value;
	switch (type) {
		case "string":
		case "number":
		case "boolean":
		case "function":
		case "symbol":
		case "bigint":
		case "undefined":
		case "object": // Catches non-null objects
			return type;
		default:
			// Should not happen for standard JavaScript types, but handles potential edge cases.
			console.warn("Encountered unexpected typeof result:", type);
			return "error"; // Treat unexpected types as errors
	}
}

/**
 * Processes a single child property (for objects) or element (for arrays).
 * Creates a `PropertyTreeNode` for the child, attaches it to the parent,
 * assigns its value if appropriate (primitive or marker), and potentially adds
 * it to the work queue for further traversal if it's an object/array and
 * within the depth limit. Handles circular reference detection before queueing.
 *
 * @param parentNode - The parent `PropertyTreeNode` to add the child node to.
 * @param keyOrIndex - The property key (string) or array index (number).
 * @param value - The value of the child property/element.
 * @param currentDepth - The depth of the `parentNode`.
 * @param maxDepth - The maximum depth to traverse.
 * @param visited - The set of visited objects for the current traversal path.
 * @param queue - The work queue for the iterative traversal.
 */
function processChild(
	parentNode: PropertyTreeNode,
	keyOrIndex: string | number,
	value: unknown,
	currentDepth: number,
	maxDepth: number,
	visited: Set<object>,
	queue: WorkItem[],
): void {
	const childName = String(keyOrIndex); // Ensure the name is a string (e.g., "0" -> "0", "[0]" -> "[0]")
	const childType = getPropertyType(value);

	const childNode: PropertyTreeNode = {
		name: childName,
		type: childType,
	};

	// parentNode.children is guaranteed to be initialised before this function is called
	// for expandable parent types by the calling logic in buildPropertyTree.s
	parentNode.children?.push(childNode);

	// Assign the 'value' property ONLY if it's a primitive type or null/undefined.
	// Functions, regular objects, and arrays do not get a 'value' property assigned here.
	if (
		childType !== "object" &&
		childType !== "array" &&
		childType !== "function"
	) {
		childNode.value = value;
	}

	// Check if the child needs further processing (is expandable object/array,
	// not null, and within depth limits).
	if (
		currentDepth + 1 < maxDepth &&
		(childType === "object" || childType === "array") &&
		value !== null // Ensures we don't try to process null as an object/array
	) {
		const valueAsObjectOrArray = value as object | unknown[];

		// Check for circular references *before* queueing.
		if (visited.has(valueAsObjectOrArray)) {
			// Assign the circular reference marker to the 'value' property.
			// This is one case where an 'object' or 'array' type node gets a 'value'.
			childNode.value = CIRCULAR_REFERENCE_MARKER;
			// Do not queue or add children array for circular references.
		} else {
			// It's an expandable, non-circular object/array within depth.
			// Initialise children array for the node.
			childNode.children = [];

			// Create a *new* Set of visited objects for this specific path.
			// This prevents siblings from interfering with each other's cycle detection.
			const childVisited = new Set(visited);
			childVisited.add(valueAsObjectOrArray);

			// Add the child to the queue for its properties/elements to be processed.
			queue.push({
				obj: valueAsObjectOrArray,
				name: childName,
				depth: currentDepth + 1,
				parent: childNode,
				visited: childVisited,
			});
		}
	}
	// Note: No 'else' block is needed here to handle reaching max depth for
	// objects/arrays/functions. In those cases, the 'value' property remains
	// correctly unset on the childNode (as per the initial creation and the first 'if').
}

/**
 * Recursively formats a `PropertyTreeNode` and its children into a
 * human-readable string representation with indentation and tree connectors.
 *
 * @param node - The `PropertyTreeNode` to format.
 * @param indent - The indentation string to use for the current level.
 * @param isLast - Boolean indicating if this node is the last sibling at its level.
 * @returns A string representation of the node and its subtree.
 */
function formatNodeToString(
	node: PropertyTreeNode,
	indent = "",
	isLast = true,
): string {
	const prefix = indent + (isLast ? "└─ " : "├─ ");
	let nodeLine = `${prefix}${node.name} (${node.type})`;

	// Add value information ONLY if the 'value' property actually exists on the node.
	// This correctly handles primitives, markers, and avoids showing anything for
	// unexpanded objects/arrays/functions (unless they are circular refs).
	if (Object.hasOwn(node, "value")) {
		// Check type again here for clarity, although hasOwn should correspond
		// to primitives or markers based on processChild logic.
		if (
			// Explicitly handle markers which might be on object/array type nodes
			node.value === CIRCULAR_REFERENCE_MARKER ||
			node.value === ACCESS_ERROR_MARKER
		) {
			nodeLine += `: ${node.value}`;
		} else if (
			node.type !== "object" &&
			node.type !== "array" &&
			node.type !== "function"
		) {
			// Handle primitive display
			if (typeof node.value === "string") {
				const displayValue = node.value.replace(/\n/g, "\\n").slice(0, 50);
				nodeLine += `: "${displayValue}${node.value.length > 50 ? "..." : ""}"`;
			} else {
				// Includes numbers, booleans, null, undefined, bigint, symbol
				nodeLine += `: ${String(node.value)}`;
			}
		}
		// Otherwise, if hasOwn is true but it's an object/array/function without a marker,
		// we don't display the value (shouldn't happen with current logic).
	}

	const lines: string[] = [nodeLine];

	if (node.children && node.children.length > 0) {
		const children = node.children;
		const childIndent = indent + (isLast ? "   " : "│  ");
		children.forEach((child, index) => {
			const isLastChild = index === children.length - 1;
			lines.push(formatNodeToString(child, childIndent, isLastChild));
		});
	}

	return lines.join("\n");
}

// --- Public API Functions ---

/**
 * Builds a property tree representation of a given JavaScript object or value.
 * Traverses the object structure up to a specified maximum depth, handling
 * primitives, objects, arrays, functions, circular references, and property
 * access errors.
 *
 * @param obj - The input object or value to build the tree from.
 * @param maxDepth - The maximum depth to traverse into nested objects/arrays.
 * Must be a non-negative integer. `0` means only the root node
 * is created, `1` includes direct children, etc.
 * @param rootName - The name to assign to the root node of the tree. Defaults to "root".
 * @returns The root `PropertyTreeNode` of the constructed tree.
 * @throws {InvalidDepthError} If `maxDepth` is negative or not an integer.
 */
export function buildPropertyTree(
	obj: unknown,
	maxDepth: number,
	rootName = "root",
): PropertyTreeNode {
	// Validate maxDepth input
	if (maxDepth < 0 || !Number.isInteger(maxDepth)) {
		throw new InvalidDepthError(maxDepth);
	}

	const rootType = getPropertyType(obj);

	// Create the root node
	const rootNode: PropertyTreeNode = {
		name: rootName,
		type: rootType,
	};

	// If the root is a primitive, null, or undefined, add its value and return immediately.
	if (
		rootType !== "object" &&
		rootType !== "array" &&
		rootType !== "function"
	) {
		rootNode.value = obj;
		return rootNode;
	}

	// If maxDepth is 0, or the root is null, or it's a function (which we don't expand),
	// return the basic root node without children or value.
	if (maxDepth === 0 || obj === null || rootType === "function") {
		return rootNode;
	}

	// At this point, obj is a non-null object or array, and maxDepth > 0.
	// Initialise children array and the work queue.
	rootNode.children = []; // Initialize children for the root
	const queue: WorkItem[] = [];
	const rootVisited = new Set<object>();
	const rootObjAsObjectOrArray = obj as object | unknown[]; // Safe cast

	rootVisited.add(rootObjAsObjectOrArray);

	queue.push({
		obj: rootObjAsObjectOrArray,
		name: rootName,
		depth: 0,
		parent: rootNode,
		visited: rootVisited,
	});

	// Iterative Breadth-First Traversal
	while (queue.length > 0) {
		// Guarded by `queue.length > 0`.
		// deno-lint-ignore no-non-null-assertion
		const item = queue.shift()!;
		const {
			obj: currentObj, // Known to be object or array here
			depth: currentDepth,
			parent: parentNode,
			visited: currentVisited, // Path-specific visited set
		} = item;

		// Process Array Elements
		if (Array.isArray(currentObj)) {
			for (let i = 0; i < currentObj.length; i++) {
				try {
					const childValue = currentObj[i];
					processChild(
						parentNode,
						`[${i}]`,
						childValue,
						currentDepth,
						maxDepth,
						currentVisited,
						queue,
					);
				} catch (error) {
					// This catch block is less common for simple array access but
					// might be relevant if elements have complex access behaviour
					// (e.g., proxies or elements being objects with throwing getters accessed indirectly).
					console.error(`Error processing array element at index ${i}:`, error);
					parentNode.children?.push({
						name: `[${i}]`,
						type: "error",
						value: ACCESS_ERROR_MARKER,
					});
				}
			}
		}
		// Process Object Properties
		else if (typeof currentObj === "object") {
			// Type guard ensures currentObj is a non-null, non-array object.
			const currentRecord = currentObj as Record<string | symbol, unknown>;

			// We only iterate over own enumerable string keys.
			// Use Reflect.ownKeys(currentRecord) if symbols or non-enumerable keys are needed.
			const keys = Object.keys(currentRecord);

			for (const key of keys) {
				try {
					const descriptor = Object.getOwnPropertyDescriptor(
						currentRecord,
						key,
					);
					if (descriptor) {
						let value: unknown;
						// Check if it's a getter before attempting to access the value.
						if (typeof descriptor.get === "function") {
							value = currentRecord[key];
						}
						// Check if it's a data descriptor with a 'value' property.
						else if (Object.hasOwn(descriptor, "value")) {
							value = descriptor.value;
						} else {
							// Handle cases with only a setter, or unusual descriptors.
							value = undefined; // Or some other indicator if needed
						}

						processChild(
							parentNode,
							key,
							value,
							currentDepth,
							maxDepth,
							currentVisited,
							queue,
						);
					}
					// If descriptor is undefined, Object.keys shouldn't have returned this key.
					// This path handles potential inconsistencies or edge cases.
				} catch (error) {
					console.error(`Error accessing property "${key}":`, error);
					parentNode.children?.push({
						name: key,
						type: "error",
						value: ACCESS_ERROR_MARKER,
					});
				}
			}
		}
	}

	return rootNode;
}

/**
 * Formats a property tree, generated by `buildPropertyTree`, into a single
 * string suitable for display or logging. Uses tree connector characters
 * for a hierarchical view.
 *
 * @param rootNode - The root `PropertyTreeNode` of the tree to format.
 * @returns A string representation of the tree.
 */
export function formatPropertyTreeToString(rootNode: PropertyTreeNode): string {
	// Start the recursive formatting from the root node.
	return formatNodeToString(rootNode, "", true);
}

/**
 * Builds a property tree for the given object and logs its formatted
 * string representation to the console. This is a convenience function
 * combining `buildPropertyTree` and `formatPropertyTreeToString`.
 *
 * @param obj - The input object or value to log.
 * @param maxDepth - The maximum depth to traverse. See `buildPropertyTree`.
 * Default value of 3 for convenience.
 * @param rootName - The name for the root node. See `buildPropertyTree`.
 * @throws {InvalidDepthError} If `maxDepth` is invalid.
 */
export function logPropertyTree(
	obj: unknown,
	maxDepth = 3,
	rootName = "root",
): void {
	const tree = buildPropertyTree(obj, maxDepth, rootName);
	console.log(formatPropertyTreeToString(tree));
}
