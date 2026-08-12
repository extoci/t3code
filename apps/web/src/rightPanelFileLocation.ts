export interface RightPanelFileLocation {
  cwd: string;
  relativePath: string;
  rootLabel: string | null;
  workspaceRelative: boolean;
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/\/+$/, "");
}

function isWindowsAbsolutePath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith("\\\\");
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith("/") || isWindowsAbsolutePath(path);
}

function workspaceRelativePath(path: string, workspaceRoot: string): string | null {
  const normalizedPath = normalizePath(path);
  const normalizedRoot = normalizePath(workspaceRoot);
  const caseInsensitive =
    /^[A-Za-z]:\//.test(normalizedPath) || /^[A-Za-z]:\//.test(normalizedRoot);
  const comparablePath = caseInsensitive ? normalizedPath.toLowerCase() : normalizedPath;
  const comparableRoot = caseInsensitive ? normalizedRoot.toLowerCase() : normalizedRoot;
  if (!comparablePath.startsWith(`${comparableRoot}/`)) return null;
  return normalizedPath.slice(normalizedRoot.length + 1);
}

function absolutePathParent(path: string): string {
  const separatorIndex = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (separatorIndex === 0) return path.slice(0, 1);
  if (separatorIndex === 2 && /^[A-Za-z]:[\\/]/.test(path)) {
    return path.slice(0, 3);
  }
  return path.slice(0, separatorIndex);
}

function basename(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, "");
  const separatorIndex = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  return separatorIndex >= 0 ? trimmed.slice(separatorIndex + 1) : trimmed;
}

export function resolveRightPanelFileLocation(
  workspaceRoot: string,
  filePath: string,
): RightPanelFileLocation {
  if (!isAbsolutePath(filePath)) {
    return {
      cwd: workspaceRoot,
      relativePath: filePath,
      rootLabel: null,
      workspaceRelative: true,
    };
  }

  const relativePath = workspaceRelativePath(filePath, workspaceRoot);
  if (relativePath) {
    return {
      cwd: workspaceRoot,
      relativePath,
      rootLabel: null,
      workspaceRelative: true,
    };
  }

  const cwd = absolutePathParent(filePath);
  return {
    cwd,
    relativePath: basename(filePath),
    rootLabel: basename(cwd) || cwd,
    workspaceRelative: false,
  };
}

export function fileSurfacePathForLocation(
  location: RightPanelFileLocation,
  relativePath: string,
): string {
  if (location.workspaceRelative) return relativePath;
  const separator = location.cwd.includes("\\") ? "\\" : "/";
  const cwd = location.cwd.replace(/[\\/]+$/, "");
  const path = separator === "\\" ? relativePath.replaceAll("/", "\\") : relativePath;
  return `${cwd}${separator}${path}`;
}
