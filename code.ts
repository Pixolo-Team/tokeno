// Create all Collection Types
type Collection = {
  name: string;
  [key: string]: object | string | number | boolean;
};

// Initialize allCollections object
const updatedTokenCollections: Collection[] = [];

// Function to create JSON for variable in collection mode
const createCollectionModeJson = async (
  variable: Variable,
  collectionMode: string,
  tempCollection: Collection
): Promise<Collection> => {
  // Split variable name into keys
  const keys = variable.name.split("/");
  // Store the value of the variable in value variable
  let value = variable.valuesByMode[collectionMode];

  // If value is an object, parse it
  if (typeof value === "object") {
    // Parse value and store it in a new variable
    const newValue = await valueParser(value as VariableAlias);
    // If newValue is not undefined, store it in value
    if (newValue !== undefined) {
      value = newValue;
    }
  }

  // Loop through each key in the keys array
  for (let i = 0; i < keys.length - 1; i++) {
    // If the key does not exist in the tempCollection, create it as an empty object
    const key = keys[i];
    if (!tempCollection[key]) {
      tempCollection[key] = {};
    }
    tempCollection = tempCollection[key] as Collection;
  }
  // Add value to the last key
  tempCollection[keys[keys.length - 1]] = value;
  // Return the updated tempCollection
  return tempCollection;
};

// Function to parse value asynchronously
const valueParser = async (value: VariableAlias | RGBA): Promise<string> => {
  // Check if value is a VariableAlias
  if ("id" in value) {
    try {
      // Get the variable by ID and store it in variable
      const variable = await figma.variables.getVariableByIdAsync(value.id);
      // If variable exists, get the collection
      if (variable) {
        const collection = await figma.variables.getVariableCollectionByIdAsync(
          variable.variableCollectionId as string
        );
        if (collection) {
          // If collection exists, parse the value and return it
          const refVariable = variable.name
            .split("/")
            .map((item) => `['${item.replace(/"/g, '\\"')}']`)
            .join("");
          return `{${collection.name}${refVariable}}`;
        }
      }
    } catch (error) {
      console.error("Error parsing value:", error);
      // Handle error
    }
  } else {
    // Convert color to hex
    return rgbaToHex(value);
  }
  return "#000000"; // Default value
};

// Function to convert rgba to hex
const rgbaToHex = (rgba: {
  r: number;
  g: number;
  b: number;
  a: number;
}): string => {
  const { r, g, b } = rgba;
  const toHex = (c: number) => {
    const hex = Math.round(c * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

// Plugin execution
if (figma.editorType === "figma") {
  figma.showUI(__html__);

  figma.ui.resize(560, 420);

  figma.ui.onmessage = async (msg) => {
    if (msg.type === "create-tokens") {
      try {
        // Get all variable collections and store them in collections
        const collections =
          await figma.variables.getLocalVariableCollectionsAsync();
        // Loop through each collection
        for (const collection of collections) {
          // Create a new collection object for each iteration
          const updatedTokenCollection = { name: collection.name };
          // Loop through each variable IDs in the collection
          for (const variableId of collection.variableIds) {
            // Get the variable by ID and store it in variable
            try {
              const variable = await figma.variables.getVariableByIdAsync(
                variableId
              );
              // If variable exists, create JSON for it
              if (variable) {
                // Create JSON for variable in collection mode
                await createCollectionModeJson(
                  variable,
                  collection.defaultModeId,
                  updatedTokenCollection
                );
              }
            } catch (error) {
              // Handle error
              console.error("Error retrieving variable:", error);
            }
          }
          // After processing all variables in the collection, add the collection to updatedCollections
          updatedTokenCollections.push(updatedTokenCollection);
        }
        // After all collections have been processed, you can do further processing or export them as JSON files
        // After processing all collections, send the data back to the UI
        figma.ui.postMessage({
          type: "all-token-collections",
          data: updatedTokenCollections,
        });
      } catch (error) {
        // Handle error
        console.error("Error retrieving collections:", error);
      }
    }
  };
}
