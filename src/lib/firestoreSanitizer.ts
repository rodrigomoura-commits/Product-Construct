export function cleanFirestoreData<T = any>(value: T): T {
  if (value === undefined) {
    return null as T;
  }

  if (value === null) {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .filter(item => item !== undefined)
      .map(item => cleanFirestoreData(item)) as T;
  }

  if (typeof value === "object") {
    // Prevent traversing into special Firestore objects
    const constructorName = value.constructor?.name;
    if (constructorName === 'Timestamp' || constructorName === 'FieldValue' || constructorName === 'FieldPath') {
      return value;
    }

    const cleaned: Record<string, any> = {};

    Object.entries(value as Record<string, any>).forEach(([key, entryValue]) => {
      if (entryValue === undefined) {
        cleaned[key] = null;
      } else {
        cleaned[key] = cleanFirestoreData(entryValue);
      }
    });

    return cleaned as T;
  }

  return value;
}
