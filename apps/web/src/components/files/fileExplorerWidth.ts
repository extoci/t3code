const FILE_EXPLORER_MIN_WIDTH = 160;
const FILE_EXPLORER_MAX_WIDTH_FRACTION = 0.7;
const FILE_CONTENT_MIN_WIDTH = 256;

export function getFileExplorerWidthLimits(containerWidth?: number) {
  if (containerWidth === undefined) {
    return { minWidth: FILE_EXPLORER_MIN_WIDTH, maxWidth: Number.POSITIVE_INFINITY };
  }
  const availableWidth = Math.max(0, Math.floor(containerWidth - FILE_CONTENT_MIN_WIDTH));
  return {
    minWidth: FILE_EXPLORER_MIN_WIDTH,
    maxWidth: Math.max(
      FILE_EXPLORER_MIN_WIDTH,
      Math.min(Math.floor(containerWidth * FILE_EXPLORER_MAX_WIDTH_FRACTION), availableWidth),
    ),
  };
}
