export function createClientChunkName(moduleId) {
  const normalizedModuleId = moduleId
    .replace(/^\.\//, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-");

  return `client-${normalizedModuleId}`;
}