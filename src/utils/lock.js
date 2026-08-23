const activeLocks = new Set();

export async function withLock(key, fn) {
  if (activeLocks.has(key)) {
    throw new Error('An operation is already in progress for this resource. Please try again.');
  }

  activeLocks.add(key);
  try {
    return await fn();
  } finally {
    activeLocks.delete(key);
  }
}

export function isLocked(key) {
  return activeLocks.has(key);
}
